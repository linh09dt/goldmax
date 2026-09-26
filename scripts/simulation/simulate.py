#!/usr/bin/env python3
"""
Mô phỏng tiến độ sản xuất cho các bộ cửa vừa nạp:
phân bố bộ theo các công đoạn để báo cáo thấy được BACKLOG / WIP / ĐANG DỞ / TRỄ / ĐÃ GIAO.

Cách làm: đọc bộ + công đoạn từ DB, tính trạng thái & mốc thời gian thực tế, ghi 2 file CSV
rồi nạp bằng COPY vào bảng tạm + UPDATE (1 lượt ghi, theo bài học V111).

Trạng thái/% suy ra ĐÚNG theo hàm của app:
  percent = XONG / (số công đoạn không BO_QUA và không phải loại CHO)
  TAM_DUNG > HOAN_THANH > DANG_SX > DA_XEP_LICH/CHO_XEP_LICH
"""
import argparse, csv, os, random, subprocess, sys
from datetime import date, datetime, timedelta

PSQL = ["psql", "-h", "localhost", "-U", "door_app", "-d", "door_production_test"]
ENV = {**os.environ, "PGPASSWORD": "test123"}

# 12 bước sản xuất theo đúng thứ tự công đoạn trong DB (mỗi bước 1 ngày làm việc)
STEPS = ["THIET_KE", "BOI_LARES", "CAT", "CHAN", "HAN", "EP_CANH",
         "TEST_CO_KHI", "SON", "VAN", "LAP_KINH", "DONG_GOI", "KHO_GIAO"]
CHO_AFTER = {"CHO_SAU_BOI_LARES": "BOI_LARES", "CHO_TRUOC_SON": "TEST_CO_KHI",
             "CHO_KHO_SAU_SON": "SON", "CHO_SAU_VAN": "VAN"}
TAM_DUNG_REASONS = ["CHO_PHOI", "CHO_LO_SON", "CHO_KINH_NGOAI", "CHO_HAN_NGOAI", "THIEU_NGUOI",
                    "MAY_HONG", "KHACH_DOI", "KHONG_DU_CHO", "CHO_CHUONG_TRINH"]
LOI_REASONS = ["LOI_HAN_SAI_VT", "LOI_MOP_MEO", "LOI_SON", "LOI_VAN", "LOI_EP_CANH", "PHE_PHAI_LAM_LAI"]
TRE_REASONS = ["TRE_CHO_PHOI", "TRE_NANG_SL", "TRE_QUA_TAI", "TRE_KHACH_DOI"]
TO_TRUONG = ["Ng. Văn Hùng", "Tr. Văn Nam", "Lê Văn Sơn", "Phạm Văn Tú", "Đỗ Văn Hải",
             "Ng. Thị Hoa", "Vũ Văn Long", "Hoàng Văn Dũng"]

# Tỷ lệ theo "độ cũ" của đơn (u = 0 đơn cũ nhất 15/09 → 1 đơn mới nhất 09/10)
#                      backlog scheduled WIP  paused done  delivered cancel
BUCKETS = [
    (0.00, 0.15, (0.00, 0.05, 0.15, 0.05, 0.15, 0.58, 0.02)),
    (0.15, 0.35, (0.05, 0.12, 0.30, 0.06, 0.15, 0.30, 0.02)),
    (0.35, 0.60, (0.15, 0.22, 0.38, 0.06, 0.10, 0.08, 0.01)),
    (0.60, 1.01, (0.45, 0.30, 0.18, 0.04, 0.02, 0.00, 0.01)),
]
SCENARIOS = ["BACKLOG", "SCHEDULED", "WIP", "PAUSED", "DONE", "DELIVERED", "CANCELLED"]


def psql_csv(sql):
    r = subprocess.run(PSQL + ["-tAc", f"COPY ({sql}) TO STDOUT WITH CSV"], capture_output=True, text=True, env=ENV)
    if r.returncode:
        sys.exit("psql lỗi: " + r.stderr[:400])
    return list(csv.reader(r.stdout.splitlines()))


def minus_wd(d, n):
    """Lùi n ngày làm việc (nghỉ Chủ nhật)."""
    while n > 0:
        d -= timedelta(days=1)
        if d.weekday() != 6:
            n -= 1
    return d


def plus_wd(d, n):
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() != 6:
            n -= 1
    return d


def last_wd_on_or_before(d):
    while d.weekday() == 6:
        d -= timedelta(days=1)
    return d


def ts(d, hour, minute=0):
    return datetime(d.year, d.month, d.day, hour, minute)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20260926)
    ap.add_argument("--today", default="2026-09-26")
    ap.add_argument("--out", default="/tmp/sim")
    a = ap.parse_args()
    rng = random.Random(a.seed)
    today = date.fromisoformat(a.today)
    today_wd = last_wd_on_or_before(today)

    rows = psql_csv(f"""select s.id, o.order_date, s.due_date, s.quantity, o.order_type, s.status
                        from production_sets s join sales_orders o on o.id = s.order_id""")
    sets = {}
    for r in rows:
        sets[int(r[0])] = dict(order_date=date.fromisoformat(r[1]) if r[1] else today,
                               due=date.fromisoformat(r[2]) if r[2] else None,
                               qty=int(r[3] or 1), otype=r[4], status=r[5])
    trows = psql_csv("""select id, set_id, stage_code, scope, seq, stage_kind, qty_expected
                        from production_tasks order by set_id, seq""")
    tasks = {}
    for r in trows:
        tasks.setdefault(int(r[1]), []).append(
            dict(id=int(r[0]), stage=r[2], scope=r[3], seq=int(r[4]), kind=r[5],
                 qty=float(r[6] or 0)))

    if not sets:
        sys.exit("Không có bộ nào trong DB.")
    dmin = min(s["order_date"] for s in sets.values())
    dmax = max(s["order_date"] for s in sets.values())
    span = max(1, (dmax - dmin).days)

    os.makedirs(a.out, exist_ok=True)
    tup, sup = open(f"{a.out}/tasks_upd.csv", "w", newline=""), open(f"{a.out}/sets_upd.csv", "w", newline="")
    tw, sw = csv.writer(tup), csv.writer(sup)
    stat = {s: 0 for s in SCENARIOS}
    late = ontime = 0
    rework_n = done_n = 0

    for sid, s in sorted(sets.items()):
        st = tasks.get(sid, [])
        u = (s["order_date"] - dmin).days / span
        weights = next(b for b in BUCKETS if b[0] <= u < b[1])[2]
        scen = rng.choices(SCENARIOS, weights=weights)[0]
        stat[scen] += 1

        step_of_task = {t["id"]: STEPS.index(t["stage"]) for t in st if t["stage"] in STEPS}
        counted = [t for t in st if t["kind"] != "CHO"]
        n_counted = len(counted)

        # số bước đã xong
        if scen in ("BACKLOG", "SCHEDULED", "CANCELLED"):
            s_done = 0
        elif scen == "WIP":
            s_done = rng.randint(1, 11)
        elif scen == "PAUSED":
            s_done = rng.randint(1, 10)
        else:
            s_done = 12

        # mốc ngày của bước cuối cùng đã xong
        planned_start = planned_end = None
        if scen == "BACKLOG":
            pass
        elif scen == "SCHEDULED":
            planned_start = plus_wd(today_wd, rng.randint(1, 18))
            planned_end = plus_wd(planned_start, 11)
        elif scen in ("WIP", "PAUSED"):
            last = minus_wd(today_wd, rng.randint(0, 2))
            planned_start = minus_wd(last, s_done - 1)
            planned_end = plus_wd(planned_start, 11)
        else:                                     # DONE / DELIVERED
            deliver = None
            if scen == "DELIVERED" and s["due"]:
                if rng.random() < 0.35:           # giao TRỄ
                    deliver = s["due"] + timedelta(days=rng.randint(1, 12))
                    late += 1
                else:
                    deliver = s["due"] - timedelta(days=rng.randint(0, 5))
                    ontime += 1
            completed = (deliver - timedelta(days=rng.randint(2, 4))) if deliver \
                else today - timedelta(days=rng.randint(1, 8))
            completed = last_wd_on_or_before(completed)
            planned_start = minus_wd(completed, 11)
            planned_end = completed

        last_done_day = planned_start and (minus_wd(planned_end, 12 - s_done) if s_done else None)
        if s_done:
            last_done_day = planned_end if s_done == 12 else minus_wd(planned_end, 12 - s_done)

        # ── công đoạn ──
        percent = 0
        paused_marked = False
        for t in st:
            step = STEPS.index(t["stage"]) if t["stage"] in STEPS else None
            if step is not None:
                done = step < s_done
                partial = step == s_done and scen in ("WIP", "PAUSED")
            else:
                base = CHO_AFTER.get(t["stage"])
                done = base is not None and STEPS.index(base) < s_done
                partial = False
            if scen == "CANCELLED":
                status, astart, aend = "CHUA_LAM", None, None
            elif done:
                status = "XONG"
                day = minus_wd(last_done_day, (s_done - 1) - step) if step is not None else last_done_day
                astart, aend = ts(day, rng.choice([7, 8, 8, 8]), rng.choice([0, 15, 30])), \
                    ts(day, rng.choice([15, 16, 16, 17]), rng.choice([0, 20, 40]))
            elif partial:
                if scen == "PAUSED":
                    status = "TAM_DUNG" if not paused_marked else "CHUA_LAM"
                    paused_marked = paused_marked or status == "TAM_DUNG"
                    astart = ts(plus_wd(last_done_day, 1) if last_done_day else today_wd, 8)
                    aend = None
                else:
                    status = "DANG_LAM" if rng.random() < 0.6 else "CHUA_LAM"
                    astart = ts(plus_wd(last_done_day, 1), 8) if last_done_day else None
                    aend = None
            else:
                status, astart, aend = "CHUA_LAM", None, None

            reason = None
            if status == "TAM_DUNG":
                reason = rng.choice(TAM_DUNG_REASONS)
            is_rework = False
            if status == "XONG" and rng.random() < 0.07:       # ~2,5% công đoạn phải làm lại (thực tế ~3%)
                is_rework, reason = True, rng.choice(LOI_REASONS)
                rework_n += 1
            if status == "XONG":
                done_n += 1
            qty_done = t["qty"] if status == "XONG" else 0
            tw.writerow([t["id"], status, astart or "", aend or "", reason or "", "true" if is_rework else "false",
                         rng.choice(TO_TRUONG) if status in ("XONG", "DANG_LAM") else "",
                         qty_done, "", "Mô phỏng"])

        # ── bộ ──
        if scen == "CANCELLED":
            set_status, percent = "HUY", 0
        elif scen == "BACKLOG":
            set_status, percent = "CHO_XEP_LICH", 0
        elif scen == "SCHEDULED":
            set_status, percent = "DA_XEP_LICH", 0
        elif scen in ("WIP", "PAUSED"):
            n_done = sum(1 for t in counted if STEPS.index(t["stage"]) < s_done if t["stage"] in STEPS)
            percent = round(n_done / n_counted * 100) if n_counted else 0
            set_status = "TAM_DUNG" if scen == "PAUSED" else "DANG_SX"
        else:
            set_status, percent = "HOAN_THANH", 100
            if scen == "DELIVERED":
                set_status = "DA_GIAO"
        completed_at = deliver_at = ""
        if scen in ("DONE", "DELIVERED"):
            completed_at = ts(planned_end, rng.choice([15, 16, 17]), 10)
            if scen == "DELIVERED":
                deliver_at = ts(deliver, rng.choice([8, 9, 14]), 0)
        note = ""
        if scen == "DELIVERED" and s["due"] and deliver > s["due"]:
            note = "Trễ hạn — " + rng.choice(TRE_REASONS)
        elif scen == "PAUSED":
            note = "Đang tạm dừng — chờ xử lý"
        sw.writerow([sid, set_status, percent, planned_start or "", planned_end or "",
                     completed_at, deliver_at,
                     "true" if s_done >= 2 else "false", "true" if s_done >= 1 else "false",
                     rng.randint(1, 3) if s_done >= 11 else "", note, "Mô phỏng"])

    tup.close()
    sup.close()
    print(f"✔ mô phỏng {len(sets)} bộ → {a.out}/sets_upd.csv, tasks_upd.csv")
    for k, v in stat.items():
        print(f"   {k:<10} {v:5d}  ({v/len(sets)*100:4.1f}%)")
    tot = late + ontime
    print(f"   giao đúng hạn: {ontime}/{tot} = {ontime/tot*100:.1f}%  (trễ {late})" if tot else "")
    print(f"   công đoạn XONG: {done_n} | làm lại: {rework_n} ({rework_n/done_n*100:.2f}%)" if done_n else "")


if __name__ == "__main__":
    main()
