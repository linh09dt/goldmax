#!/usr/bin/env python3
"""Nạp đơn mô phỏng vào app qua đúng API POST /api/orders (giống thao tác tạo đơn thật)."""
import json, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = "http://localhost:3000"
SRC = "/tmp/sim/payloads.jsonl"


def post(payload):
    r = urllib.request.Request(BASE + "/api/orders", data=json.dumps(payload).encode(),
                               headers={"Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                return True, json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code in (409, 400):
                return False, body
        except Exception as e:                                    # noqa: BLE001
            body = repr(e)
        time.sleep(1.5 * (attempt + 1))
    return False, body


def main():
    orders = [json.loads(l) for l in open(SRC, encoding="utf-8")]
    only = int(sys.argv[1]) if len(sys.argv) > 1 else len(orders)
    orders = orders[:only]
    ok = bad = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=8) as pool:
        for done, (good, info) in enumerate(pool.map(post, orders), 1):
            if good:
                ok += 1
            else:
                bad += 1
                if bad <= 5:
                    print("  ✗", orders[done - 1]["orderCode"], info)
            if done % 200 == 0:
                print(f"  … {done}/{len(orders)}  ({time.time()-t0:.0f}s)")
    print(f"✔ tạo được {ok} đơn, lỗi {bad}, mất {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
