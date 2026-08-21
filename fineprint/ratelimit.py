"""Tiny in-memory sliding-window rate limiter for the public playground endpoints."""
from collections import defaultdict, deque


class Limiter:
    def __init__(self, max_hits: int, window_s: int):
        self.max_hits, self.window_s = max_hits, window_s
        self._hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str, now: float) -> bool:
        q = self._hits[key]
        while q and now - q[0] > self.window_s:
            q.popleft()
        if len(q) >= self.max_hits:
            return False
        q.append(now)
        return True
