"""Fetch one owned private object. Never accept or follow a user-provided URL."""
import hashlib
import json
from pathlib import Path
import httpx
from fastapi import HTTPException

BLOB_MIME = 'application/vnd.signhearing.blob+json'
MAX_BYTES = 20 * 1024 * 1024
MIMES = {'application/json':'frames.json','video/mp4':'clip.mp4','video/webm':'clip.webm'}

def validate_descriptor(raw, claims):
    try:
        descriptor = json.loads(raw)
        if (set(descriptor) != {'pathname','bytes','sha256','content_type'}
            or descriptor['pathname'] != 'inference/'+claims['jti']+'/payload'
            or type(descriptor['bytes']) is not int or not 0 < descriptor['bytes'] <= MAX_BYTES
            or descriptor['content_type'] not in MIMES
            or not isinstance(descriptor['sha256'],str)
            or len(descriptor['sha256']) != 64
            or any(c not in '0123456789abcdef' for c in descriptor['sha256'])):
            raise ValueError()
        return descriptor
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400,'invalid_video') from None

async def receive_private_blob(raw, claims, settings, directory):
    descriptor = validate_descriptor(raw, claims)
    if not settings.ai_blob_origin or not settings.blob_read_write_token.get_secret_value():
        raise HTTPException(503,'ai_unavailable')
    path = Path(directory)/MIMES[descriptor['content_type']]
    digest = hashlib.sha256(); size=0
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=settings.ai_upload_timeout,
                                    trust_env=False) as client:
            async with client.stream('GET', settings.ai_blob_origin+'/'+descriptor['pathname'],
                headers={'Authorization':'Bearer '+settings.blob_read_write_token.get_secret_value(),
                         'Cache-Control':'no-store'}) as response:
                if response.status_code != 200:
                    raise HTTPException(503,'ai_unavailable')
                with path.open('wb') as stream:
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > MAX_BYTES or size > descriptor['bytes']:
                            raise HTTPException(413,'video_too_large')
                        digest.update(chunk); stream.write(chunk)
    except httpx.HTTPError:
        raise HTTPException(503,'ai_unavailable') from None
    if size != descriptor['bytes'] or digest.hexdigest() != descriptor['sha256']:
        raise HTTPException(400,'invalid_video')
    return path, descriptor['content_type']
