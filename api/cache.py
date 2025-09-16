# api/cache.py
from __future__ import annotations

import time
from threading import RLock
from typing import Any, Optional, Tuple


class SimpleTTLCache:
    """
    Very small in-memory TTL cache suitable for per-process FastAPI instances.
    - Not multiprocess-safe; good enough for a single Uvicorn worker.
    - Keys must be hashable tuples/strings.
    """

    def __init__(self) -> None:
        self._store: dict[Any, Tuple[float, Any]] = {}
        self._lock = RLock()

    def get(self, key: Any) -> Optional[Any]:
        now = time.time()
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at < now:
                # expired
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: Any, value: Any, ttl_seconds: float) -> None:
        expires_at = time.time() + float(ttl_seconds)
        with self._lock:
            self._store[key] = (expires_at, value)

    def invalidate(self, key: Any) -> None:
        with self._lock:
            self._store.pop(key, None)


cache = SimpleTTLCache()