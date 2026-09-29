"""Live updates: an in-process publish/subscribe bus behind the SSE streams.

Anything that changes a victim's picture - a new distress reading, a score,
an alert, a case issue, an insight, a message, a callback request, an
outreach call - is published here, and every open dashboard of the
counsellor it concerns hears about it at once instead of on the next poll.

publish() is called from worker threads (FastAPI runs the sync service code in
a thread pool), so it hands the event to the event loop with
call_soon_threadsafe. Before bind() it is a no-op, which keeps scripts,
manage.py and the tests free of an event loop.

Single-process only: with several uvicorn workers, put Redis pub/sub (or
Postgres LISTEN/NOTIFY) behind the same two functions.
"""

import asyncio
import json
import threading
import time

HEARTBEAT_S = 15
QUEUE_MAX = 500           # a stalled client is dropped rather than growing without bound

_loop = None
_subscribers = {}         # key -> set of asyncio.Queue
_lock = threading.Lock()


def bind(loop):
    global _loop
    _loop = loop


def _deliver(key, event):
    for queue in list(_subscribers.get(key, ())):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            pass


def publish(key, event_type, /, **data):
    """key: the counsellor's (or victim's) user id the event is for. Positional-only,
    so payload fields may use any name (kind, status...)."""
    if _loop is None or not key:
        return
    event = {**data, "type": event_type, "at": time.time()}
    try:
        _loop.call_soon_threadsafe(_deliver, key, event)
    except RuntimeError:        # loop closed during shutdown
        pass


def subscribe(key):
    queue = asyncio.Queue(maxsize=QUEUE_MAX)
    with _lock:
        _subscribers.setdefault(key, set()).add(queue)
    return queue


def unsubscribe(key, queue):
    with _lock:
        subs = _subscribers.get(key)
        if subs is not None:
            subs.discard(queue)
            if not subs:
                _subscribers.pop(key, None)


def listeners(key):
    return len(_subscribers.get(key, ()))


async def sse(key, is_disconnected):
    """Server-sent events for one subscriber, with a heartbeat so proxies and
    the browser both notice a dead connection."""
    queue = subscribe(key)
    try:
        yield f"event: ready\ndata: {json.dumps({'type': 'ready', 'at': time.time()})}\n\n"
        while True:
            if await is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_S)
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
                continue
            yield f"event: {event['type']}\ndata: {json.dumps(event, default=str)}\n\n"
    finally:
        unsubscribe(key, queue)
