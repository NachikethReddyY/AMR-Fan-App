"""One leased native MPS process, a restricted /v1/systemone contract."""
import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import fcntl
import json
import os
from pathlib import Path
import socket
import subprocess
import re
import signal
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = json.loads((ROOT / 'services/api/ai/questions.json').read_text())
PINS = json.loads((Path(__file__).parent / 'models.json').read_text())
CACHE = Path.home() / '.cache/amr/laya'
MAX_BYTES = 8192
MAX_MEMORY = 4 * 1024**3


def validate_payload(value, model):
    if not isinstance(value, dict) or set(value) - {'state', 'questions', 'model'}:
        raise ValueError('invalid request keys')
    state, questions = value.get('state'), value.get('questions')
    if not isinstance(state, str) or not 1 <= len(state.strip()) <= 1600:
        raise ValueError('state must contain 1 to 1600 characters')
    if not isinstance(questions, dict) or not questions or not set(questions) <= QUESTIONS.keys():
        raise ValueError('unsupported questions')
    if set(questions) not in ({'tag'}, {'moderation'}, {'tag', 'moderation'}, {'category'}):
        raise ValueError('unsupported question combination')
    if any(question != QUESTIONS[key] for key, question in questions.items()):
        raise ValueError('question definitions must match the app contract')
    if value.get('model', model) != model:
        raise ValueError('checkpoint is fixed for the service lifetime')
    return value


def create_app(agent, model, stats):
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse
    pool = ThreadPoolExecutor(max_workers=1)
    busy = False

    @asynccontextmanager
    async def lifespan(_app):
        yield
        pool.shutdown(wait=True, cancel_futures=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.get('/health')
    def health():
        return {'status':'ok', 'model':model, 'revision':PINS['models'][model]['revision'], 'device':str(agent.device), **stats}

    @app.post('/v1/systemone')
    async def predict(request: Request):
        nonlocal busy
        # No browser origins, queue, batch endpoint, custom question or second model.
        if request.headers.get('origin'):
            raise HTTPException(403, 'browser origin not allowed')
        if busy:
            raise HTTPException(503, 'busy')
        busy = True
        future = None
        try:
            body = bytearray()
            async with asyncio.timeout(2):
                async for chunk in request.stream():
                    if len(body) + len(chunk) > MAX_BYTES:
                        raise HTTPException(413, 'request too large')
                    body.extend(chunk)
            try:
                payload = validate_payload(json.loads(body), model)
            except (ValueError, TypeError, RecursionError):
                raise HTTPException(400, 'invalid request') from None
            state = payload['state']
            # Reserve the complete model question budget. Never silently truncate state.
            tokens = agent.tok(state.replace(agent.tok.mask_token, ' '), add_special_tokens=False)['input_ids']
            if len(tokens) > agent.cfg.get('max_len', 512) - agent.cfg.get('head_max_len', 192) - 8:
                raise HTTPException(413, 'context exceeds checkpoint limit')
            started = time.monotonic()
            def infer():
                stats['inferenceStarted'] = time.monotonic()
                try:
                    return agent.predict(state, payload['questions'])
                finally:
                    stats['inferenceStarted'] = None
            future = asyncio.get_running_loop().run_in_executor(pool, infer)
            result = await asyncio.wait_for(asyncio.shield(future), 4)
            # Runtime output is still untrusted at the TypeScript adapter boundary.
            encoded = json.dumps(result, allow_nan=False)
            if len(encoded.encode()) > 16384:
                raise HTTPException(502, 'invalid model response')
            stats['requests'] += 1
            return JSONResponse(result, headers={'X-Inference-Time-Ms':str(round((time.monotonic()-started)*1000, 2))})
        except TimeoutError:
            raise HTTPException(504, 'deadline exceeded') from None
        except HTTPException:
            raise
        except Exception:
            # Do not leak model inputs, filesystem paths or provider errors.
            raise HTTPException(502, 'inference unavailable') from None
        finally:
            if future is not None and not future.done():
                def release(completed):
                    nonlocal busy
                    if not completed.cancelled():
                        completed.exception()  # Consume late errors without logging input.
                    busy = False
                future.add_done_callback(release)
            else:
                busy = False
    return app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', choices=list(PINS['models']), default=PINS['selected'])
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = (CACHE / 'runtime.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('A shared Laya process already owns the runtime lock') from None
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 55434))
    os.environ['HF_HOME'] = str(CACHE / 'huggingface')
    os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    os.environ['OMP_NUM_THREADS'] = '2'
    import psutil
    stats = {'rssBytes':0, 'peakRssBytes':0, 'requests':0, 'inferenceStarted':None}
    process = psutil.Process()
    def watchdog():
        next_pressure_check = 0
        while True:
            rss = process.memory_info().rss
            stats.update(rssBytes=rss, peakRssBytes=max(rss, stats['peakRssBytes']))
            started = stats['inferenceStarted']
            if time.monotonic() >= next_pressure_check:
                try:
                    pressure = subprocess.run(['memory_pressure'], capture_output=True, text=True, timeout=3)
                except (OSError, subprocess.TimeoutExpired):
                    os.write(2, b'Laya stopping: host capacity check unavailable\n')
                    os.kill(os.getpid(), signal.SIGTERM)
                    return
                match = re.search(r'System-wide memory free percentage: (\d+)%', pressure.stdout)
                if not match or int(match[1]) < 50:
                    os.write(2, b'Laya stopping: host capacity below lease bound\n')
                    os.kill(os.getpid(), signal.SIGTERM)
                    return
                next_pressure_check = time.monotonic() + 2
            if rss > MAX_MEMORY or (started is not None and time.monotonic()-started > 10):
                # Own process only. A stuck GPU operation cannot be cancelled safely in a thread.
                os.write(2, b'Laya stopped: memory or inference deadline exceeded\n')
                os._exit(75)
            time.sleep(0.1)
    threading.Thread(target=watchdog, daemon=True).start()
    import torch
    if not torch.backends.mps.is_available():
        raise SystemExit('Native MPS unavailable; no silent CPU substitution')
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    from laya import Agent
    pin = PINS['models'][args.model]
    started = time.monotonic()
    agent = Agent(pin['repo'], revision=pin['revision'], device='mps', expected_sha256={'model.safetensors':pin['weightsSha256']})
    if str(agent.device) != 'mps':
        raise SystemExit('Expected MPS device')
    stats['loadSeconds'] = round(time.monotonic()-started, 3)
    import uvicorn
    uvicorn.run(create_app(agent, args.model, stats), host='127.0.0.1', port=55434, workers=1,
                access_log=False, log_level='warning', timeout_keep_alive=2, backlog=8)

if __name__ == '__main__': main()
