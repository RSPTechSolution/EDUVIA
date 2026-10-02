from app.core.redis import get_redis


async def hit(key: str, limit: int, window_seconds: int) -> bool:
    """Count one attempt. Returns False when the limit is exceeded."""
    redis = get_redis()
    async with redis.pipeline(transaction=True) as pipe:
        pipe.incr(key)
        pipe.expire(key, window_seconds, nx=True)
        count, _ = await pipe.execute()
    return int(count) <= limit


async def reset(key: str) -> None:
    await get_redis().delete(key)
