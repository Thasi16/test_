from fastapi.testclient import TestClient
from app.api import ai
from app.core.config import Settings
from app.main import create_app
from app.services import ai_tokens


def test_binding_uses_same_origin_transport_without_revealing_private_address(verified_identity,monkeypatch):
    secret='test-only-shared-signing-key-at-least-32-bytes'
    settings=Settings(siformer_service_url='http://private.internal.invalid',ai_token_secret=secret,_env_file=None)
    monkeypatch.setattr(ai,'get_settings',lambda:settings)
    with TestClient(create_app(),base_url='https://testserver') as client:
        response=client.post('/api/ai/token',json={'slug':'an'},headers={'Origin':'https://testserver'})
        assert response.status_code==200
        assert response.json()['endpoint']=='/api/ai/infer'
        assert 'private.internal' not in response.text and secret not in response.text
        claims=ai_tokens.verify(response.json()['token'],secret,'https://testserver')
        assert claims['sub']==verified_identity.user['id'] and claims['exp']-claims['iat']==120
