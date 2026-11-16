"""Vercel-specific transport ownership and shared-state security tests."""
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import pytest
from fastapi import HTTPException
from ai_inference.app.config import Settings
from ai_inference.app.blob_transport import validate_descriptor
from ai_inference.app.shared_state import RedisGuard


def descriptor():
    return dict(pathname='inference/owned/payload',bytes=100,sha256='a'*64,content_type='video/mp4')

@pytest.mark.parametrize('field,value',[
    ('pathname','https://evil.test/steal'),('pathname','inference/other/payload'),
    ('pathname','inference/owned/../payload'),('bytes',True),('bytes',20*1024*1024+1),
    ('sha256','z'*64),('content_type','text/html'),
])
def test_private_blob_descriptor_rejects_cross_user_urls_and_limits(field,value):
    raw=descriptor();raw[field]=value
    with pytest.raises(HTTPException): validate_descriptor(json.dumps(raw),{'jti':'owned'})

def test_exact_descriptor_and_fixed_private_store():
    assert validate_descriptor(json.dumps(descriptor()),{'jti':'owned'})==descriptor()
    for origin in ('https://evil.test','https://example.public.blob.vercel-storage.com',
                   'https://example.private.blob.vercel-storage.com/path'):
        with pytest.raises(ValueError): Settings(ai_blob_origin=origin,_env_file=None)

def redis_guards():
    url=os.environ.get('AI_TEST_REDIS_URL')
    if not url: pytest.skip('AI_TEST_REDIS_URL required for real Redis concurrency test')
    settings=Settings(ai_redis_url=url,ai_state_namespace='qa:'+uuid4().hex+':',_env_file=None)
    return RedisGuard(settings),RedisGuard(settings)

def claims(user='same-user'):
    return dict(sub=user,jti=uuid4().hex,exp=int(time.time())+120)

def status(guard,c,phase='infer'):
    try: guard.reserve(c,phase);return 200
    except HTTPException as e:return e.status_code

def test_token_cannot_replay_across_independent_instances():
    a,b=redis_guards();c=claims()
    try:
        assert status(a,c)==200
        assert status(b,c)==401
        assert status(b,claims())==429
        assert status(b,claims('different-user'))==200
    finally:a.close();b.close()

def test_atomic_reservation_under_concurrent_replicas():
    a,b=redis_guards();c=claims()
    try:
        with ThreadPoolExecutor(max_workers=8) as executor:
            results=list(executor.map(lambda i:status(a if i%2 else b,c),range(16)))
        assert results.count(200)==1 and results.count(401)==15
    finally:a.close();b.close()

def test_upload_grant_is_single_use_and_inference_remains_available():
    a,b=redis_guards();c=claims()
    try:
        assert status(a,c,'upload')==200
        assert status(b,c,'upload')==401
        assert status(b,c)==200
        assert status(a,c)==401
    finally:a.close();b.close()

def test_shared_state_connection_failure_fails_closed():
    guard=RedisGuard(Settings(ai_redis_url='redis://127.0.0.1:1',_env_file=None))
    try: assert status(guard,claims())==503
    finally:guard.close()


def test_private_upload_restores_exact_bytes_and_rejects_redirects(monkeypatch,tmp_path):
    import asyncio
    import hashlib
    import httpx
    from ai_inference.app.blob_transport import receive_private_blob
    payload=b'original JPEG payload bytes, never recompressed'
    settings=Settings(ai_blob_origin='https://store.private.blob.vercel-storage.com',
        blob_read_write_token='private-test-only-placeholder',_env_file=None)
    desc=dict(pathname='inference/owned/payload',bytes=len(payload),
        sha256=hashlib.sha256(payload).hexdigest(),content_type='application/json')
    original=httpx.AsyncClient
    requests=[]
    def handle(request):
        requests.append(request)
        assert str(request.url)=='https://store.private.blob.vercel-storage.com/inference/owned/payload'
        assert request.headers['authorization']=='Bearer private-test-only-placeholder'
        return httpx.Response(200,content=payload)
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(transport=httpx.MockTransport(handle),**kw))
    path,mime=asyncio.run(receive_private_blob(json.dumps(desc),{'jti':'owned'},settings,tmp_path))
    assert path.read_bytes()==payload and mime=='application/json'
    desc['sha256']='0'*64
    with pytest.raises(HTTPException) as error:
        asyncio.run(receive_private_blob(json.dumps(desc),{'jti':'owned'},settings,tmp_path))
    assert error.value.status_code==400
    def redirect(request):return httpx.Response(302,headers={'Location':'https://evil.test/'})
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(transport=httpx.MockTransport(redirect),**kw))
    with pytest.raises(HTTPException) as error:
        asyncio.run(receive_private_blob(json.dumps(desc),{'jti':'owned'},settings,tmp_path))
    assert error.value.status_code==503


def test_vercel_cannot_use_memory_or_non_tls_shared_state(monkeypatch):
    monkeypatch.setenv('VERCEL','1')
    for options in ({},{'ai_state_backend':'redis','ai_redis_url':'redis://remote.test'}):
        with pytest.raises(ValueError):Settings(_env_file=None,**options)
    monkeypatch.setenv('VERCEL_URL','preview.example.vercel.app')
    settings=Settings(ai_state_backend='redis',ai_redis_url='rediss://secure.test',_env_file=None)
    assert 'https://preview.example.vercel.app' in settings.ai_allowed_origins
