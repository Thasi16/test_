"""Atomic capability consumption across all serverless replicas. Fail closed."""
import hashlib
from fastapi import HTTPException

# Redis TIME avoids replica clock skew. A sorted set preserves the original
# 2,000 outstanding-token cap and expires automatically after the last token.
RESERVE = """
local now = redis.call('TIME'); now = tonumber(now[1]) + tonumber(now[2])/1000000
local expiry = tonumber(ARGV[2])
if expiry <= now then return 401 end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 401 end
if redis.call('EXISTS', KEYS[2]) == 1 or redis.call('ZCARD', KEYS[1]) >= 2000 then return 429 end
redis.call('ZADD', KEYS[1], expiry, ARGV[1])
redis.call('EXPIRE', KEYS[1], 125)
redis.call('SET', KEYS[2], '1', 'PX', 3000)
return 200
"""

class RedisGuard:
    def __init__(self, settings):
        import redis
        if not settings.ai_redis_url.get_secret_value():
            raise ValueError('Shared replay state is required')
        self.redis = redis.Redis.from_url(settings.ai_redis_url.get_secret_value(),
            socket_connect_timeout=3, socket_timeout=3, retry_on_timeout=False)
        self.namespace = settings.ai_state_namespace

    def reserve(self, claims, phase='infer'):
        # The inference and upload phases each consume their own one-use grant.
        subject = hashlib.sha256(claims['sub'].encode()).hexdigest()
        token = hashlib.sha256(claims['jti'].encode()).hexdigest()
        try:
            status = self.redis.eval(RESERVE, 2, self.namespace+phase+':used',
                self.namespace+phase+':user:'+subject, token, claims['exp'])
        except Exception:
            raise HTTPException(503, 'ai_unavailable') from None
        if status == 401:
            raise HTTPException(401, 'token_already_used')
        if status != 200:
            raise HTTPException(429, 'rate_limited')

    def close(self):
        self.redis.close()
