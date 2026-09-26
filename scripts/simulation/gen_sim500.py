#!/usr/bin/env python3
"""
SIM-500 — Sinh 500 đơn mô phỏng cho module Lên kế hoạch sản xuất (GOLDMAX)
xuất ra 10 file SQL tự chứa (mỗi file 50 đơn) để nạp trực tiếp vào PostgreSQL.

Khác sim-1000-don.sql:
  • Bộ số (set_no) do SQL cấp lúc nạp (không nhúng sẵn) → nạp vào DB đang có đơn thật,
    các file nối tiếp nhau, không trùng, không giảm bộ đếm.
  • production_tasks KHÔNG hard-code mã công đoạn: sinh bằng SQL từ chính
    `production_stages` của DB đích → chạy được cả danh mục CŨ (CAT/CHAN/HAN/VAN,
    scope_mode='PARTS') lẫn danh mục MỚI sau V139 (CAT_CANH…, scope_mode='PART').

Dùng:
    python3 scripts/simulation/gen_sim500.py [--seed 20260926] [--out sim-500]
"""
import argparse
import os
import random
import re
import sys
from datetime import date, datetime, time, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen  # noqa: E402  — danh mục THẬT + build_order/make_dealers/dims (KHÔNG chép lại)

# ── Tham số bộ dữ liệu ───────────────────────────────────────────────────────
TODAY = date(2026, 9, 26)          # mốc "hôm nay"
# V142b — BỘ DỮ LIỆU "BACKLOG SẠCH": đơn đặt trong tháng 10–11, giao trong tháng 10–11,
# TẤT CẢ bộ ở CHỜ XẾP LỊCH (chưa gán ngày, chưa sản xuất, không làm lại).
DATE_FROM = date(2026, 10, 1)      # ngày đặt sớm nhất
DATE_TO = date(2026, 11, 10)       # ngày đặt muộn nhất (để còn ≥ 15 ngày trước 30/11)
DELIVERY_TO = date(2026, 11, 30)   # ngày giao muộn nhất
N_ORDERS = 500
PER_FILE = 50                      # 10 file × 50 đơn
DRAFT_RATE = 0.0                   # 0% đơn nháp — cả 500 đơn đều đưa vào kế hoạch được

# Số dòng bộ cửa mỗi đơn (tối đa 5)
LINES = [1, 2, 3, 4, 5]
LINES_W = [38, 28, 18, 10, 6]

# Số lượng mỗi dòng (tối đa 10 — lệch, chủ yếu 1–3)
QTY = list(range(1, 11))
QTY_W = [52, 22, 12, 5, 3.5, 2.0, 1.2, 0.9, 0.6, 0.6]

# Thứ tự bước (seq) — GIỐNG NHAU ở cả danh mục cũ & mới (16 bước).
SEQS = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 85, 90, 95, 100, 110, 120]

# V142b — Trạng thái bộ: 100% BACKLOG (chờ xếp lịch) để tập làm kế hoạch từ đầu.
# Muốn quay lại bộ dữ liệu "có WIP/đã giao/trễ" thì đặt lại tỉ lệ như cũ:
#   {"DELIVERED": 0.14, "DONE": 0.09, "WIP": 0.30, "PAUSED": 0.05,
#    "SCHEDULED": 0.18, "CANCELLED": 0.02, "BACKLOG": 0.22}
SCEN_TARGET = {  # scenario -> tỉ lệ
    "BACKLOG": 1.0,
}

SET_STATUS = {
    "BACKLOG": "CHO_XEP_LICH", "SCHEDULED": "DA_XEP_LICH", "WIP": "DANG_SX",
    "PAUSED": "TAM_DUNG", "DONE": "HOAN_THANH", "DELIVERED": "DA_GIAO",
    "CANCELLED": "HUY",
}
# state điều khiển trạng thái task trong SQL
STATE = {
    "BACKLOG": "NONE", "SCHEDULED": "NONE", "CANCELLED": "NONE",
    "WIP": "WIP", "PAUSED": "PAUSED", "DONE": "ALLDONE", "DELIVERED": "ALLDONE",
}

TO_TRUONG = ["Ng. Văn Hùng", "Tr. Văn Nam", "Lê Văn Sơn", "Phạm Văn Tú", "Đỗ Văn Hải",
             "Ng. Thị Hoa", "Vũ Văn Long", "Hoàng Văn Dũng"]
TAM_DUNG_CODES = ["CHO_PHOI", "CHO_CHUONG_TRINH", "CHO_LO_SON", "CHO_KINH_NGOAI",
                  "CHO_HAN_NGOAI", "KHACH_DOI", "THIEU_NGUOI", "MAY_HONG", "KHONG_DU_CHO"]
LOI_CODES = ["LOI_MOP_MEO", "LOI_HAN_SAI_VT", "LOI_SON", "LOI_VAN", "LOI_EP_CANH", "PHE_PHAI_LAM_LAI"]
TRE_CODES = ["TRE_CHO_PHOI", "TRE_QUA_TAI", "TRE_NANG_SL", "TRE_KHACH_DOI"]

TS_SIM = "2026-09-26 06:00:00"     # created_at/updated_at cố định của bản ghi mô phỏng


# ── Kiểu dữ liệu cột (để ép kiểu literal khi xuất SQL) ───────────────────────
INT_COLS = {"line_no", "row_order", "sort_order", "group_no", "seq", "priority", "percent_done",
            "quantity", "leaves_per_set", "trim_bars_per_set", "height_mm", "width_mm", "frame_mm",
            "clear_height_mm", "clear_width_mm", "pack_count", "source_row", "canh_equivalent",
            "done_seq", "active_seq", "leaves", "qty", "trim"}
NUM_COLS = {"pricing_quantity", "unit_price", "amount", "qty_expected", "qty_done", "delivery_km",
            "shipping_fee", "subtotal", "discount_percent", "discount_amount", "total_after_discount",
            "deposit_amount", "warehouse_receipt_deduction", "delivery_payment"}
DATE_COLS = {"order_date", "required_delivery_date", "excel_update_date", "due_date",
             "planned_start", "planned_end", "pstart"}
TS_COLS = {"created_at", "updated_at", "actual_completed_at", "actual_delivered_at",
           "actual_start", "actual_end"}
BOOL_COLS = {"is_rework", "program_ready", "material_ready", "shipping_mountain_district"}


def sql_type(col):
    if col in INT_COLS:
        return "int"
    if col in NUM_COLS:
        return "float8"
    if col in DATE_COLS:
        return "date"
    if col in TS_COLS:
        return "timestamp"
    if col in BOOL_COLS:
        return "boolean"
    return "varchar"


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def val(col, v):
    if v is None or v == "":
        return "NULL::" + sql_type(col)
    if col in BOOL_COLS:
        return "true" if v else "false"
    if col in INT_COLS:
        return str(int(v))
    if col in NUM_COLS:
        return repr(float(v)) if isinstance(v, float) else str(v)
    if col in DATE_COLS:
        return q(v.isoformat() if isinstance(v, (date, datetime)) else v) + "::date"
    if col in TS_COLS:
        if isinstance(v, datetime):
            v = v.strftime("%Y-%m-%d %H:%M:%S")
        return q(v) + "::timestamp"
    return q(v)


def rows_values(cols, rows):
    return ",\n  ".join("(" + ",".join(val(c, r.get(c)) for c in cols) + ")" for r in rows)


# ── Lịch làm việc (nghỉ Chủ nhật) ────────────────────────────────────────────
def plus_wd(d, n):
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() != 6:
            n -= 1
    return d


def minus_wd(d, n):
    while n > 0:
        d -= timedelta(days=1)
        if d.weekday() != 6:
            n -= 1
    return d


def last_wd_on_or_before(d):
    while d.weekday() == 6:
        d -= timedelta(days=1)
    return d


def ts(d, hour, minute=0):
    return datetime(d.year, d.month, d.day, hour, minute)


# ── build_order có điều khiển số dòng bộ cửa ─────────────────────────────────
class ForcedLines(random.Random):
    """random.Random nhưng ép `build_order` sinh đúng 1 dòng bộ cửa mỗi lượt gọi."""

    def __init__(self, seed):
        super().__init__(seed)
        self.forced_lines = None

    def choices(self, population, weights=None, *, cum_weights=None, k=1):
        if (self.forced_lines is not None and len(population) == 15
                and population[0] == 1 and population[-1] == 15):
            n, self.forced_lines = self.forced_lines, None
            return [n]
        return super().choices(population, weights=weights, cum_weights=cum_weights, k=k)


def build_line(rng, day_seq, cust_seq, od, due):
    rng.forced_lines = 1
    return gen.build_order(rng, 0, day_seq, cust_seq, od, due)


def is_window(name):
    return "Cửa Sổ" in name


def build_order(rng, od, due, day_seq):
    n_lines = rng.choices(LINES, weights=LINES_W)[0]
    header, items = None, []
    for _ in range(n_lines):
        o = build_line(rng, day_seq, 1, od, due)
        if header is None:
            header = o
        items.append(o["items"][0])
    return header, items


# ── Sinh dữ liệu ─────────────────────────────────────────────────────────────
def generate(seed):
    rng = ForcedLines(seed)
    gen.DEALERS = gen.make_dealers(rng, 70)

    span = (DATE_TO - DATE_FROM).days
    day_count, cust_count = {}, {}
    draft_idx = set(rng.sample(range(N_ORDERS), round(DRAFT_RATE * N_ORDERS)))

    orders = []
    for i in range(N_ORDERS):
        od = DATE_FROM + timedelta(days=rng.randint(0, span))
        # Ngày giao: RẢI ĐỀU trong khoảng cho phép [od+15 ngày, min(od+45 ngày, 30/11)]
        # — KHÔNG cộng rồi chặn trần, vì làm vậy mọi đơn muộn sẽ dồn hết vào 30/11.
        gap_lo, gap_hi = 15, min(45, (DELIVERY_TO - od).days)
        due = od + timedelta(days=rng.randint(gap_lo, max(gap_lo, gap_hi)))
        day_count[od] = day_count.get(od, 0) + 1
        day_seq = day_count[od]

        header, items = build_order(rng, od, due, day_seq)
        code = header["customerCode"]
        cust_count[code] = cust_count.get(code, 0) + 1
        cust_seq = cust_count[code]
        order_code = f"{od:%y%m%d}{day_seq:02d}{code}DH{cust_seq:02d}"

        order_type = rng.choices(["SAN_XUAT", "MAU", "LAM_LAI"], weights=[70, 20, 10])[0]
        status = "NHAP" if i in draft_idx else "DA_XAC_NHAN"

        for ln, it in enumerate(items, 1):
            it["lineNo"] = ln
            it["setNo"] = None
            qty = rng.choices(QTY, weights=QTY_W)[0]
            it["quantity"] = qty
            it["trim_bars_per_set"] = (it["leavesPerSet"] or 1) + (4 if is_window(it["productName"]) else 3)
            khl = round(it["heightMm"] * it["widthMm"] * qty / 1_000_000, 4)
            it["pricingQuantity"] = khl
            it["amount"] = round(khl * it["unitPrice"], 2)

        # tiền đơn: subtotal → chiết khấu → còn lại → đặt cọc → thanh toán khi giao
        subtotal = sum(it["amount"] + sum(d["amount"] for d in it["details"]) for it in items)
        if rng.random() >= 0.75:
            subtotal += rng.randrange(200000, 1500000, 50000)
        subtotal = round(subtotal, 2)
        discount = header["discountPercent"]
        discount_amount = round(subtotal * discount / 100, 2)
        after = round(subtotal - discount_amount, 2)
        deposit = header["depositAmount"]
        order = dict(
            order_code=order_code, order_type=order_type, status=status,
            customer_code=code, customer_name=header["customerName"],
            sales_employee_code=header["salesEmployeeCode"],
            order_date=od, required_delivery_date=due,
            receiver_name=header["receiverName"] or None, receiver_phone=header["receiverPhone"],
            receiver_address=header["receiverAddress"], delivery_km=header["deliveryKm"] or None,
            region=header["region"] or None, group_no=None, excel_update_date=od,
            shipping_fee=0, shipping_mountain_district=False,
            subtotal=subtotal, discount_percent=discount, discount_amount=discount_amount,
            total_after_discount=after, deposit_amount=deposit,
            warehouse_receipt_deduction=0, delivery_payment=round(after - deposit, 2),
            created_at=ts(od, 8, (i * 7) % 60), updated_at=ts(od, 8, (i * 7) % 60),
            items=items,
            requirements=[dict(code=r["code"], question_text=r["questionText"],
                               answer=r["answer"] or None, note=None, sort_order=r["sortOrder"])
                          for r in header["requirements"]],
            sets=[],
        )
        orders.append(order)

    _assign_scenarios(rng, orders)
    return orders


def _assign_scenarios(rng, orders):
    """Gán trạng thái bộ theo ĐỘ CŨ của đơn — phân bố tổng thể đúng tỉ lệ mục tiêu."""
    lines = []                                    # mỗi dòng bộ cửa = 1 bộ trong kế hoạch
    for o in orders:
        if o["status"] == "NHAP":
            continue
        u = (o["order_date"] - DATE_FROM).days / max(1, (DATE_TO - DATE_FROM).days)
        for it in o["items"]:
            lines.append((u + rng.gauss(0, 0.10), o, it))

    n = len(lines)
    counts = {k: int(round(v * n)) for k, v in SCEN_TARGET.items()}
    counts["BACKLOG"] += n - sum(counts.values())        # dồn phần dư vào backlog
    # từ CŨ nhất → MỚI nhất, mức độ hoàn thành giảm dần (dùng .get để chạy được cả khi
    # SCEN_TARGET chỉ có 1 loại — vd bộ dữ liệu BACKLOG SẠCH)
    ordered = []
    for name in ("DELIVERED", "DONE", "WIP", "CANCELLED", "PAUSED", "SCHEDULED", "BACKLOG"):
        ordered.extend([name] * counts.get(name, 0))
    lines.sort(key=lambda x: x[0])                # cũ (u nhỏ) trước
    for (_, o, it), scen in zip(lines, ordered):
        o["sets"].append(dict(item=it, scen=scen))

    # OTD ≈ 70%: đúng round(70%) số bộ ĐÃ GIAO là giao đúng hạn
    delivered = [s for o in orders for s in o["sets"] if s["scen"] == "DELIVERED"]
    k = int(round(0.70 * len(delivered)))
    flags = [True] * k + [False] * (len(delivered) - k)
    rng.shuffle(flags)
    for s, fl in zip(delivered, flags):
        s["ontime"] = fl
    return counts


def build_set(rng, o, s):
    """Tính mọi trường của 1 bộ (trừ set_no do SQL cấp)."""
    it, scen = s["item"], s["scen"]
    today_wd = last_wd_on_or_before(TODAY)
    leaves = it["leavesPerSet"] or 1
    qty = it["quantity"] or 1
    trim = it["trim_bars_per_set"]
    due = o["required_delivery_date"]

    s_done = 0
    pstart = pend = None
    completed = deliver = None
    if scen == "SCHEDULED":
        pstart = plus_wd(today_wd, rng.randint(1, 18))
        pend = plus_wd(pstart, len(SEQS) - 1)
    elif scen in ("WIP", "PAUSED"):
        s_done = rng.randint(1, len(SEQS) - 1)
        last_done = minus_wd(today_wd, rng.randint(1, 3))
        pstart = minus_wd(last_done, s_done - 1)
        pend = plus_wd(pstart, len(SEQS) - 1)
    elif scen in ("DONE", "DELIVERED"):
        if scen == "DELIVERED":
            if s.get("ontime", rng.random() < 0.70):      # OTD ≈ 70%
                deliver = due - timedelta(days=rng.randint(0, 5))
            else:
                deliver = due + timedelta(days=rng.randint(1, 12))
            completed = last_wd_on_or_before(deliver - timedelta(days=rng.randint(2, 4)))
        else:
            completed = minus_wd(today_wd, rng.randint(1, 8))
        pstart = minus_wd(completed, len(SEQS) - 1)
        pend = completed

    done_seq = SEQS[s_done - 1] if s_done else 0
    active_seq = SEQS[s_done] if s_done < len(SEQS) else 0

    note = None
    if scen == "PAUSED":
        note = "Đang tạm dừng — chờ xử lý"
    elif scen == "DELIVERED" and deliver and due and deliver > due:
        note = "Trễ hạn — " + rng.choice(TRE_CODES)

    created = ts(o["order_date"], 8, 30)
    return dict(
        scen=scen, state=STATE[scen], status=SET_STATUS[scen],
        done_seq=done_seq, active_seq=active_seq, pstart=pstart, leaves=leaves, qty=qty, trim=trim,
        due_date=due, priority=(rng.randint(1, 2) if o["order_type"] == "LAM_LAI"
                                else (rng.choice([3, 4]) if o["order_type"] == "MAU" else 5)),
        planned_start=pstart, planned_end=pend,
        actual_completed_at=(ts(completed, rng.choice([15, 16, 17]), 10)
                             if completed else None),
        actual_delivered_at=(ts(deliver, rng.choice([8, 9, 14]), 0) if deliver else None),
        program_ready=(scen not in ("BACKLOG", "CANCELLED")),
        material_ready=(scen not in ("BACKLOG", "SCHEDULED", "CANCELLED")),
        pack_count=(rng.randint(2, 6) if scen in ("DONE", "DELIVERED") else None),
        note=note,
        created_at=created, updated_at=created,
    )


# ── Xuất SQL ─────────────────────────────────────────────────────────────────
ORD_COLS = ["order_code", "order_type", "status", "customer_code", "customer_name",
            "sales_employee_code", "order_date", "required_delivery_date", "receiver_name",
            "receiver_phone", "receiver_address", "delivery_km", "region", "group_no",
            "excel_update_date", "shipping_fee", "shipping_mountain_district", "subtotal",
            "discount_percent", "discount_amount", "total_after_discount", "deposit_amount",
            "warehouse_receipt_deduction", "delivery_payment", "created_at", "updated_at"]
IT_COLS = ["line_no", "set_no", "product_name", "product_code", "model", "opening_direction",
           "trim_direction", "paint_color", "height_mm", "width_mm", "frame_mm", "clear_height_mm",
           "clear_width_mm", "panel_info", "trim_bars_per_set", "trim_type", "lock_model",
           "window_bars", "leaves_per_set", "quantity", "unit", "pricing_quantity", "unit_price",
           "amount", "note", "image_path", "source_row", "created_at", "updated_at"]
DT_COLS = ["row_order", "detail_type", "product_name", "product_code", "model", "height_mm",
           "width_mm", "unit", "pricing_quantity", "unit_price", "amount", "created_at", "updated_at"]
RQ_COLS = ["code", "question_text", "answer", "note", "sort_order", "created_at", "updated_at"]
SE_COLS = ["set_no", "order_type", "customer_name", "product_name", "model", "opening_direction",
           "paint_color", "veneer_code", "height_mm", "width_mm", "leaves_per_set",
           "trim_bars_per_set", "quantity", "pricing_quantity", "canh_equivalent", "due_date",
           "priority", "status", "percent_done", "planned_start", "planned_end",
           "actual_completed_at", "actual_delivered_at", "program_ready", "material_ready",
           "pack_count", "note", "created_at", "updated_at"]


def item_row(o, it):
    return dict(
        order_code=o["order_code"], line_no=it["lineNo"], set_no=None,
        product_name=it["productName"], product_code=it["productCode"], model=it["model"],
        opening_direction=it["openingDirection"], trim_direction=it["trimDirection"],
        paint_color=it["paintColor"], height_mm=it["heightMm"], width_mm=it["widthMm"],
        frame_mm=it["frameMm"], clear_height_mm=it["clearHeightMm"], clear_width_mm=it["clearWidthMm"],
        panel_info=it["panelInfo"], trim_bars_per_set=it["trim_bars_per_set"], trim_type=None,
        lock_model=None, window_bars=None, leaves_per_set=it["leavesPerSet"],
        quantity=it["quantity"], unit=it["unit"], pricing_quantity=it["pricingQuantity"],
        unit_price=it["unitPrice"], amount=it["amount"], note=it["note"], image_path=None,
        source_row=None, created_at=o["created_at"], updated_at=o["updated_at"],
    )


def detail_row(o, it, d):
    return dict(
        order_code=o["order_code"], line_no=it["lineNo"], row_order=d["rowOrder"],
        detail_type=d["detailType"], product_name=d["productName"], product_code=d["productCode"],
        model=d["model"], height_mm=d.get("heightMm"), width_mm=d.get("widthMm"), unit=d["unit"],
        pricing_quantity=d["pricingQuantity"], unit_price=d["unitPrice"], amount=d["amount"],
        created_at=o["created_at"], updated_at=o["updated_at"],
    )


def set_row(o, it, st):
    return dict(
        order_code=o["order_code"], line_no=it["lineNo"], order_type=o["order_type"],
        customer_name=o["customer_name"], product_name=it["productName"], model=it["model"],
        opening_direction=it["openingDirection"], paint_color=it["paintColor"], veneer_code=None,
        height_mm=it["heightMm"], width_mm=it["widthMm"], leaves_per_set=it["leavesPerSet"],
        trim_bars_per_set=it["trim_bars_per_set"], quantity=it["quantity"],
        pricing_quantity=it["pricingQuantity"], canh_equivalent=(it["leavesPerSet"] or 1) * (it["quantity"] or 1),
        due_date=o["required_delivery_date"], priority=st["priority"], status=st["status"],
        percent_done=0, planned_start=st["planned_start"], planned_end=st["planned_end"],
        actual_completed_at=st["actual_completed_at"], actual_delivered_at=st["actual_delivered_at"],
        program_ready=st["program_ready"], material_ready=st["material_ready"],
        pack_count=st["pack_count"], note=st["note"],
        created_at=st["created_at"], updated_at=st["updated_at"],
    )


def sql_head(i, n_files):
    return f"""-- ============================================================================
-- GOLDMAX · SIM-500 — DỮ LIỆU MÔ PHỎNG MODULE LÊN KẾ HOẠCH SẢN XUẤT
--   File {i}/{n_files} · {N_ORDERS} đơn chia {n_files} file × {PER_FILE} đơn
--   Nạp tuần tự don-001-050.sql → don-451-500.sql để Bộ số liên tục, không trùng.
--
-- CÁCH DÙNG:  Dán cả file vào SQL Editor (Supabase) hoặc  psql "<CHUỖI KẾT NỐI>" -f <file>
-- MỖI CÂU TỰ CHỨA: KHÔNG bảng tạm, KHÔNG session state ⇒ dán/chạy được cả khi công cụ
--   chạy từng câu một (autocommit / pooler / mỗi câu một connection).
-- YÊU CẦU:    DB đã chạy migration của app + đã seed danh mục sản xuất
--             (production_stages / production_work_centers / production_reasons).
-- GỠ BỎ:      chạy sim-500/sim-500-CLEANUP.sql
--
-- production_tasks sinh BẰNG SQL từ chính production_stages của DB đích
-- ⇒ chạy được cho CẢ danh mục cũ (CAT/CHAN/HAN/VAN) lẫn danh mục mới sau V139.
-- ============================================================================
BEGIN;
SET client_min_messages = warning;
"""


# Bộ số: base = GREATEST(bộ đếm hiện có, MAX(set_no) đang có) — tính trong chính câu INSERT.
BASE_SQL = ("GREATEST(\n"
            "         COALESCE(NULLIF((SELECT value FROM system_settings"
            " WHERE key = 'ORDER_SET_NUMBER_COUNTER'), '')::bigint, 0),\n"
            "         COALESCE((SELECT MAX(set_no::bigint) FROM sales_order_items"
            " WHERE set_no ~ '^[0-9]{1,18}$'), 0)\n"
            "       )")

# Đơn nháp (status <> DA_XAC_NHAN) KHÔNG cấp Bộ số; row_number chỉ đếm đơn đã xác nhận
# ⇒ nạp tuần tự 10 file cho số liên tục, không trùng, không giảm bộ đếm.
SET_NO_EXPR = ("CASE WHEN o.status = 'DA_XAC_NHAN'\n"
               "            THEN (b.base + row_number() OVER (PARTITION BY (o.status = 'DA_XAC_NHAN')\n"
               "                                             ORDER BY v.order_code, v.line_no))::text\n"
               "            ELSE NULL::text END")


def sql_tasks_insert(ctl_rows):
    """Câu 7 — công đoạn: 1 dòng = 1 bộ × 1 (công đoạn active × scope), TỰ CHỨA.

    `ctl_rows` chỉ chở tham số điều khiển tiến độ (state/done_seq/active_seq/pstart);
    số cánh/khung/phào và set_no đọc thẳng từ `production_sets` (JOIN theo khoá tự nhiên).
    """
    names = "ARRAY[" + ",".join(q(x) for x in TO_TRUONG) + "]"
    tam = "ARRAY[" + ",".join(q(x) for x in TAM_DUNG_CODES) + "]"
    loi = "ARRAY[" + ",".join(q(x) for x in LOI_CODES) + "]"
    step = ",".join(f"({s},{i})" for i, s in enumerate(SEQS))
    vcols = ["order_code", "line_no", "state", "done_seq", "active_seq", "pstart"]
    return f"""-- CÔNG ĐOẠN: 1 dòng = 1 bộ × 1 công đoạn (sinh từ production_stages của DB đích)
INSERT INTO production_tasks (set_id, order_item_id, stage_code, scope, stage_kind, seq,
  work_center_code, status, qty_expected, qty_done, planned_start, planned_end,
  actual_start, actual_end, assignee, is_rework, rework_from_stage, reason_code, note,
  updated_by, created_at, updated_at)
SELECT s.id, i.id, ps.code, sc.scope, ps.kind, ps.seq, ps.work_center_code,
       t.status, t.qty_expected,
       CASE WHEN t.status = 'XONG' THEN t.qty_expected ELSE NULL END,
       pd.plan_date, pd.plan_date,
       CASE WHEN t.status IN ('XONG','DANG_LAM','TAM_DUNG') AND pd.plan_date IS NOT NULL
            THEN pd.plan_date + make_interval(hours => 7 + t.h1 % 2, mins => (t.h2 % 4) * 15) END,
       CASE WHEN t.status = 'XONG' AND pd.plan_date IS NOT NULL
            THEN pd.plan_date + make_interval(hours => 15 + t.h3 % 3, mins => (t.h4 % 3) * 20) END,
       CASE WHEN t.status IN ('XONG','DANG_LAM','TAM_DUNG')
            THEN ({names})[1 + t.h5 % 8] END,
       (t.status = 'XONG' AND t.h6 < 3),
       NULL::varchar,
       CASE WHEN t.status = 'TAM_DUNG' THEN ({tam})[1 + t.h7 % 9]
            WHEN t.status = 'XONG' AND t.h6 < 3 THEN ({loi})[1 + t.h8 % 6]
            ELSE NULL END,
       NULL::text, 'Mô phỏng', '{TS_SIM}'::timestamp, '{TS_SIM}'::timestamp
FROM (VALUES
  {rows_values(vcols, ctl_rows)}
) AS v(order_code, line_no, state, done_seq, active_seq, pstart)
JOIN sales_orders o ON o.order_code = v.order_code
JOIN sales_order_items i ON i.order_id = o.id AND i.line_no = v.line_no
JOIN production_sets s ON s.order_item_id = i.id
JOIN production_stages ps ON ps.active
JOIN LATERAL (
  SELECT unnest(CASE ps.scope_mode
         WHEN 'PARTS' THEN string_to_array(ps.scope_parts, ',')
         WHEN 'PART'  THEN string_to_array(ps.scope_parts, ',')
         ELSE ARRAY['BO'] END) AS scope
) sc ON true
LEFT JOIN (VALUES {step}) AS step(seq, idx) ON step.seq = ps.seq
LEFT JOIN LATERAL (
  SELECT w.d::date AS plan_date
  FROM (
    SELECT g.d, row_number() OVER (ORDER BY g.d) AS rn
    FROM generate_series(v.pstart::timestamp, (v.pstart + 40)::timestamp, interval '1 day') AS g(d)
    WHERE extract(dow FROM g.d) <> 0          -- nghỉ Chủ nhật
  ) w
  WHERE w.rn = step.idx + 1
) pd ON true
CROSS JOIN LATERAL (
  SELECT
    (CASE
       WHEN v.state = 'ALLDONE' THEN 'XONG'
       WHEN v.state = 'NONE' THEN 'CHUA_LAM'
       WHEN ps.seq <= v.done_seq THEN 'XONG'
       WHEN ps.seq = v.active_seq
            THEN CASE WHEN v.state = 'PAUSED' THEN 'TAM_DUNG' ELSE 'DANG_LAM' END
       ELSE 'CHUA_LAM'
     END) AS status,
    (CASE sc.scope
       WHEN 'CANH' THEN s.leaves_per_set * s.quantity
       WHEN 'KHUNG' THEN s.quantity
       WHEN 'PHAO' THEN s.trim_bars_per_set * s.quantity
       ELSE s.quantity
     END) AS qty_expected,
    (abs(hashtext('1' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h1,
    (abs(hashtext('2' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h2,
    (abs(hashtext('3' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h3,
    (abs(hashtext('4' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h4,
    (abs(hashtext('5' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h5,
    (abs(hashtext('6' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h6,
    (abs(hashtext('7' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h7,
    (abs(hashtext('8' || s.set_no || ps.code || sc.scope)::bigint) % 100)::int AS h8
) t;
"""


def sql_percent_update(order_codes):
    """Câu 8 — % hoàn thành của các bộ THUỘC FILE NÀY (lọc theo order_code, không bảng tạm)."""
    codes = ",\n       ".join(q(c) for c in order_codes)
    return ("-- % hoàn thành của bộ = XONG / (số công đoạn không BO_QUA và không phải kind 'CHO')\n"
            "UPDATE production_sets s\n"
            "SET percent_done = COALESCE(sub.p, 0)\n"
            "FROM (\n"
            "  SELECT t.set_id,\n"
            "         round(100.0 * count(*) FILTER (WHERE t.status = 'XONG' AND t.stage_kind <> 'CHO')\n"
            "               / NULLIF(count(*) FILTER (WHERE t.status <> 'BO_QUA' AND t.stage_kind <> 'CHO'), 0))::int AS p\n"
            "  FROM production_tasks t\n"
            "  JOIN production_sets s2 ON s2.id = t.set_id\n"
            "  JOIN sales_orders o ON o.id = s2.order_id\n"
            "  WHERE o.order_code IN (\n"
            "       " + codes + ")\n"
            "  GROUP BY t.set_id\n"
            ") sub\n"
            "WHERE s.id = sub.set_id;")


def sql_counter():
    return """-- Đẩy bộ đếm Bộ số (không bao giờ giảm)
INSERT INTO system_settings (key, value, created_at, updated_at)
SELECT 'ORDER_SET_NUMBER_COUNTER',
       COALESCE(MAX(set_no::bigint), 0)::text, now(), now()
FROM sales_order_items
WHERE set_no ~ '^[0-9]{1,18}$'
ON CONFLICT (key) DO UPDATE
   SET value = GREATEST(system_settings.value::bigint, EXCLUDED.value::bigint)::text,
       updated_at = now();

COMMIT;
"""


def make_file(idx, total, orders):
    """9 câu tự chứa (thứ tự 1→9 bắt buộc) — không bảng tạm, không session state."""
    L = [sql_head(idx, total)]
    item_rows = [(o, it) for o in orders for it in o["items"]]
    set_rows = [(o, s) for o in orders for s in o["sets"]]

    # 1) ĐƠN HÀNG
    L.append("INSERT INTO sales_orders (" + ",".join(ORD_COLS) + ") VALUES\n  "
             + rows_values(ORD_COLS, orders) + ";")

    # 2) BỘ CỬA — Bộ số cấp NGAY trong câu INSERT (base + row_number)
    it_vals = ["order_code"] + [c for c in IT_COLS if c != "set_no"]
    rows = [item_row(o, it) for o, it in item_rows]
    sel = ["o.id", "v.line_no", SET_NO_EXPR] + ["v." + c for c in IT_COLS if c not in ("line_no", "set_no")]
    L.append("INSERT INTO sales_order_items (order_id," + ",".join(IT_COLS) + ")\n"
             "SELECT " + ", ".join(sel) + "\n"
             "FROM (VALUES\n  " + rows_values(it_vals, rows) + "\n) AS v(" + ",".join(it_vals) + ")\n"
             "JOIN sales_orders o ON o.order_code = v.order_code\n"
             "CROSS JOIN (SELECT " + BASE_SQL + " AS base) b;")

    # 3) HÀNG KÈM — JOIN theo (order_code, line_no)
    d_rows = [(o, it, d) for o, it in item_rows for d in it["details"]]
    if d_rows:
        dv = ["order_code", "line_no"] + DT_COLS
        L.append("INSERT INTO sales_order_item_details (order_item_id," + ",".join(DT_COLS) + ")\n"
                 "SELECT i.id," + ",".join("v." + c for c in DT_COLS) + "\n"
                 "FROM (VALUES\n  " + rows_values(dv, [detail_row(o, it, d) for o, it, d in d_rows])
                 + "\n) AS v(" + ",".join(dv) + ")\n"
                 "JOIN sales_orders o ON o.order_code = v.order_code\n"
                 "JOIN sales_order_items i ON i.order_id = o.id AND i.line_no = v.line_no;")

    # 4) CÂU HỎI XÁC NHẬN — JOIN theo order_code
    rq_rows = [(o, r) for o in orders for r in o["requirements"]]
    rv = ["order_code"] + RQ_COLS
    L.append("INSERT INTO sales_order_requirements (order_id," + ",".join(RQ_COLS) + ")\n"
             "SELECT o.id," + ",".join("v." + c for c in RQ_COLS) + "\n"
             "FROM (VALUES\n  " + rows_values(rv, [dict(r, order_code=o["order_code"], created_at=o["created_at"],
                                     updated_at=o["updated_at"]) for o, r in rq_rows]) + "\n) AS v("
             + ",".join(rv) + ")\nJOIN sales_orders o ON o.order_code = v.order_code;")

    # 5) BỘ TRONG KẾ HOẠCH — set_no lấy lại từ sales_order_items (KHÔNG tính lại)
    se_rows = [set_row(o, s["item"], s["ctl"]) for o, s in set_rows]
    se_vals = ["order_code", "line_no"] + [c for c in SE_COLS if c != "set_no"]
    L.append("INSERT INTO production_sets (order_id,order_item_id,order_code," + ",".join(SE_COLS) + ")\n"
             "SELECT o.id, i.id, v.order_code, i.set_no,"
             + ",".join("v." + c for c in SE_COLS if c != "set_no") + "\n"
             "FROM (VALUES\n  " + rows_values(se_vals, se_rows) + "\n) AS v(" + ",".join(se_vals) + ")\n"
             "JOIN sales_orders o ON o.order_code = v.order_code\n"
             "JOIN sales_order_items i ON i.order_id = o.id AND i.line_no = v.line_no;")

    # Tham số điều khiển tiến độ theo bộ (dùng cho câu 6 & 7)
    ctl_rows = [dict(order_code=o["order_code"], line_no=s["item"]["lineNo"],
                     state=s["ctl"]["state"], done_seq=s["ctl"]["done_seq"],
                     active_seq=s["ctl"]["active_seq"], pstart=s["ctl"]["pstart"]) for o, s in set_rows]

    # 6) LỆNH CON (3 dòng / bộ — đọc số lượng từ production_sets)
    cv = ["order_code", "line_no"]
    L.append("-- LỆNH SẢN XUẤT CON: CANH / KHUNG / PHAO\n"
             "INSERT INTO production_component_orders (set_id, kind, qty_expected, note, created_at, updated_at)\n"
             "SELECT s.id, k.kind,\n"
             "       CASE k.kind WHEN 'CANH' THEN s.leaves_per_set * s.quantity\n"
             "                   WHEN 'KHUNG' THEN s.quantity\n"
             "                   WHEN 'PHAO' THEN s.trim_bars_per_set * s.quantity END,\n"
             "       NULL, '" + TS_SIM + "'::timestamp, '" + TS_SIM + "'::timestamp\n"
             "FROM (VALUES\n  " + rows_values(cv, ctl_rows) + "\n) AS v(order_code, line_no)\n"
             "JOIN sales_orders o ON o.order_code = v.order_code\n"
             "JOIN sales_order_items i ON i.order_id = o.id AND i.line_no = v.line_no\n"
             "JOIN production_sets s ON s.order_item_id = i.id\n"
             "CROSS JOIN (VALUES ('CANH'), ('KHUNG'), ('PHAO')) AS k(kind);")

    # 7) CÔNG ĐOẠN (sinh từ production_stages của DB đích, tham số tiến độ trong VALUES)
    L.append(sql_tasks_insert(ctl_rows))

    # 8) % HOÀN THÀNH CỦA BỘ
    L.append(sql_percent_update([o["order_code"] for o in orders]))

    # 9) BỘ ĐẾM BỘ SỐ
    L.append(sql_counter())
    return "\n\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20260926)
    ap.add_argument("--out", default="sim-500")
    a = ap.parse_args()
    out = a.out if os.path.isabs(a.out) else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", a.out)
    out = os.path.normpath(out)
    os.makedirs(out, exist_ok=True)

    rng = ForcedLines(a.seed)
    orders = generate(a.seed)

    # tính điều khiển tiến độ cho từng bộ (dùng rng riêng để không phá cấu trúc đơn)
    ctl_rng = random.Random(a.seed + 7)
    for o in orders:
        for s in o["sets"]:
            s["ctl"] = build_set(ctl_rng, o, s)

    n_files = (len(orders) + PER_FILE - 1) // PER_FILE
    files = []
    for i in range(n_files):
        chunk = orders[i * PER_FILE:(i + 1) * PER_FILE]
        name = f"don-{i*PER_FILE+1:03d}-{i*PER_FILE+len(chunk):03d}.sql"
        path = os.path.join(out, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(make_file(i + 1, n_files, chunk))
        files.append(path)

    # CLEANUP — xoá đúng 500 mã đơn mô phỏng (mỗi câu tự chứa, không bảng tạm)
    codes = [o["order_code"] for o in orders]
    in_list = ",\n       ".join(q(c) for c in codes)
    cl = ["-- ============================================================================",
          "-- GOLDMAX · SIM-500 — GỠ DỮ LIỆU MÔ PHỎNG (chạy ngược 10 file don-*.sql)",
          "--    Dán vào SQL Editor hoặc  psql \"<CHUỖI KẾT NỐI>\" -f sim-500/sim-500-CLEANUP.sql",
          "-- MỖI CÂU TỰ CHỨA: không bảng tạm, không session state.",
          "-- Chỉ xoá đúng 500 mã đơn MÔ PHỎNG — không đụng đơn thật.",
          "-- Bộ đếm Bộ số (system_settings.ORDER_SET_NUMBER_COUNTER) giữ nguyên.",
          "-- ============================================================================",
          "BEGIN;", "SET client_min_messages = warning;"]
    cl.append("DELETE FROM production_tasks t\n"
              " USING production_sets s, sales_orders o\n"
              " WHERE t.set_id = s.id AND s.order_id = o.id AND o.order_code IN (\n"
              "       " + in_list + ");")
    cl.append("DELETE FROM production_component_orders c\n"
              " USING production_sets s, sales_orders o\n"
              " WHERE c.set_id = s.id AND s.order_id = o.id AND o.order_code IN (\n"
              "       " + in_list + ");")
    cl.append("DELETE FROM production_sets s\n"
              " USING sales_orders o\n"
              " WHERE s.order_id = o.id AND o.order_code IN (\n"
              "       " + in_list + ");")
    cl.append("DELETE FROM sales_orders o WHERE o.order_code IN (\n       " + in_list + ");")
    cl.append("COMMIT;\nSELECT (SELECT count(*) FROM sales_orders) AS don_con_lai,\n"
              "       (SELECT count(*) FROM production_sets) AS bo_con_lai,\n"
              "       (SELECT count(*) FROM production_tasks) AS cong_doan_con_lai;")
    with open(os.path.join(out, "sim-500-CLEANUP.sql"), "w", encoding="utf-8") as f:
        f.write("\n\n".join(cl) + "\n")

    # README
    n_sets = sum(len(o["sets"]) for o in orders)
    tot_bo = sum((s["item"]["quantity"] or 1) for o in orders for s in o["sets"])
    n_lines = sum(len(o["items"]) for o in orders)
    n_items_conf = sum(len(o["items"]) for o in orders if o["status"] != "NHAP")
    scen = {}
    for o in orders:
        for s in o["sets"]:
            scen[s["scen"]] = scen.get(s["scen"], 0) + 1
    otypes = {}
    for o in orders:
        otypes[o["order_type"]] = otypes.get(o["order_type"], 0) + 1
    drafts = sum(1 for o in orders if o["status"] == "NHAP")
    readme = f"""# SIM-500 — BỘ DỮ LIỆU MÔ PHỎNG 500 ĐƠN (MODULE LÊN KẾ HOẠCH SẢN XUẤT)

Ngày tạo: **26/09/2026** · Seed `20260926` · **BỘ DỮ LIỆU BACKLOG SẠCH** — để **tập làm kế hoạch từ đầu**:
cả 500 đơn đã xác nhận, **chưa bộ nào được xếp lịch, chưa bộ nào đang sản xuất, không có làm lại**.

## 1. Nội dung

| Hạng mục | Số lượng |
|---|---|
| Đơn hàng | **500** (chia 10 file × 50 đơn) |
| Dòng bộ cửa (mỗi dòng = 1 Bộ số) | {n_lines} (tối đa 5 dòng/đơn) |
| Dòng thuộc đơn đã xác nhận (vào kế hoạch) | {n_items_conf} |
| **Bộ trong kế hoạch** (`production_sets`) | **{n_sets}** — mỗi dòng đúng 1 bộ |
| Tổng số bộ theo số lượng | **{tot_bo}** (mỗi dòng ≤ 10 bộ) |
| Lệnh con Cánh/Khung/Phào | {n_sets * 3} (3 lệnh/bộ) |
| Công đoạn (`production_tasks`) | {n_sets} × 24 (tuỳ danh mục cũ/mới, luôn 24 dòng/bộ) |
| Câu hỏi xác nhận | {len(orders) * 6} |

- **Ngày đặt hàng:** {DATE_FROM:%d/%m/%Y} → {DATE_TO:%d/%m/%Y} — **trong tháng 10–11/2026**.
- **Ngày giao khách:** **trong tháng 10–11/2026**, muộn nhất **30/11/2026**, và luôn **≥ 15 ngày** sau ngày đặt.
- **Loại đơn:** SAN_XUAT {otypes.get('SAN_XUAT', 0)} · MAU {otypes.get('MAU', 0)} · LAM_LAI {otypes.get('LAM_LAI', 0)}.
- **Đơn nháp:** {drafts} — đã tắt, cả 500 đơn đều `DA_XAC_NHAN` nên **đưa vào kế hoạch được ngay**.

## 2. Trạng thái — **TẤT CẢ LÀ BACKLOG**

| Trạng thái bộ | Số bộ | Ngày kế hoạch | Tiến độ |
|---|---|---|---|
| **CHO_XEP_LICH** (chờ xếp lịch) | {scen.get('BACKLOG', 0)} | *chưa gán* | 0% |

Mọi công đoạn ở **CHUA_LAM**: `qty_done` = NULL, `planned_start/planned_end` = NULL, `actual_*` = NULL,
`assignee` NULL, `is_rework` = false, `reason_code` NULL. Đây là **điểm xuất phát sạch** để bạn tự gán ngày
(xếp lịch bằng tay — V141), rồi theo dõi bảng tải / cảnh báo / báo cáo tự cập nhật theo.

## 3. Đặc điểm kỹ thuật

- **Bộ số cấp trong SQL**, tính **ngay trong câu `INSERT INTO sales_order_items`** (không bảng tạm):
  `base = GREATEST(counter, MAX(set_no::bigint))` + `row_number()` → nạp tuần tự 10 file cho số **liên tục, không trùng**,
  không bao giờ giảm `system_settings.ORDER_SET_NUMBER_COUNTER`. `production_sets.set_no` **lấy lại** từ
  `sales_order_items.set_no` qua JOIN (không tính lại).
- **Mỗi câu TỰ CHỨA** — không dùng bảng tạm, không session state; liên kết id giải bằng JOIN/subquery
  theo **khoá tự nhiên** (`sales_orders.order_code`, `sales_order_items.line_no`, `production_sets.order_item_id`).
  Bộ cửa của đơn nháp (`NHAP`) có `set_no = NULL` và không sinh bộ.
- **`production_tasks` sinh bằng SQL từ `production_stages` của DB đích** (không hard-code mã công đoạn):
  - `scope_mode='PARTS'` → tách theo `string_to_array(scope_parts, ',')`;
  - `scope_mode='PART'` → 1 scope; `'BO'`/`'MODEL'` → scope `'BO'`.
  - `qty_expected`: CANH = số cánh × số bộ · KHUNG = số bộ · PHAO = số phào × số bộ · BO = số bộ.
  - Trạng thái: bộ dữ liệu này chạy ở chế độ `state='NONE'` ⇒ **mọi công đoạn CHUA_LAM**, **không có ngày kế hoạch**
    (máy vẫn giữ nhánh sinh tiến độ cho các chế độ khác nếu sau này cần bộ dữ liệu có WIP/đã giao).
- **Không sinh lệnh sản xuất (V142).** Sau khi nạp đủ 10 file, chạy MỘT LẦN
  `migrate-production-v142-lenh-cong-doan.sql` (mục 2→3→4) để mọi bộ có đủ lệnh cha + 3 lệnh con + 1 lệnh/công đoạn;
  câu 5 của file đó kiểm tra và báo lỗi nếu thiếu.
  - `percent_done` của bộ = XONG / (số công đoạn không `BO_QUA` và không phải kind `'CHO'`).
- Chạy được cho **cả danh mục CŨ** (CAT/CHAN/HAN/VAN, `scope_mode='PARTS'`) **lẫn danh mục MỚI** sau V139
  (CAT_CANH…, `scope_mode='PART'`).

## 4. Cách nạp

```bash
# DB phải đã có bảng của app + danh mục sản xuất (production_stages…)
psql "<CHUỖI KẾT NỐI>" -f sim-500/don-001-050.sql
psql "<CHUỖI KẾT NỐI>" -f sim-500/don-051-100.sql
# … lần lượt tới …
psql "<CHUỖI KẾT NỐI>" -f sim-500/don-451-500.sql
```
Mỗi file gồm **9 câu, thứ tự 1→9 bắt buộc** (đơn → bộ cửa + Bộ số → hàng kèm → câu hỏi → bộ trong kế hoạch
→ lệnh con → công đoạn → `percent_done` → bộ đếm Bộ số). **Mọi câu TỰ CHỨA**: không bảng tạm,
không session state ⇒ dán cả file vào SQL Editor (Supabase / pooler) hay chạy **từng câu một / mỗi câu một connection**
đều đúng. Nạp **đúng thứ tự 1→10** để Bộ số liên tục.

## 5. Cách gỡ

```bash
psql "<CHUỖI KẾT NỐI>" -f sim-500/sim-500-CLEANUP.sql
```

> ⚠️ **Đã nạp bộ SIM-500 CŨ** (bản trước: đơn 08–10/2026, có bộ đang sản xuất / đã giao / làm lại)?
> Chạy **`sim-500/sim-500-CLEANUP-ban-cu.sql`** trước để gỡ sạch, rồi mới nạp 10 file dưới đây —
> nếu không bạn sẽ có **2 bộ dữ liệu chồng nhau** (mã đơn khác nhau nên không ghi đè).
Xoá **đúng 500 mã đơn mô phỏng** (cascade công đoạn / lệnh con / bộ / bộ cửa / hàng kèm / câu hỏi).
Bộ đếm `ORDER_SET_NUMBER_COUNTER` giữ nguyên — muốn trả về giá trị cũ thì tự `UPDATE`.

## 6. Sinh lại / kiểm chứng

```bash
python3 scripts/simulation/gen_sim500.py          # sinh lại 10 file (seed cố định)
node scripts/simulation/verify_sim500.mjs          # chạy từ thư mục gốc dự án
```
Verifier dùng `@electric-sql/pglite`: chạy 18 migration → seed danh mục → nạp 10 file,
kiểm tra **cả danh mục CŨ và MỚI**, in bảng kết quả.
Kèm kiểm tra **tự chứa**: `grep "TEMP"` và `grep "_sim_"` trong `sim-500/don-*.sql` phải = **0 dòng**.
"""
    with open(os.path.join(out, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme)

    print(f"✔ SIM-500 → {out}")
    print(f"  đơn={len(orders)} · dòng={n_lines} · bộ trong kế hoạch={n_sets} · "
          f"tổng bộ theo SL={tot_bo} · nháp={drafts}")
    for k in ("BACKLOG", "SCHEDULED", "WIP", "PAUSED", "DONE", "DELIVERED", "CANCELLED"):
        v = scen.get(k, 0)
        print(f"   {k:<10} {v:5d}  ({v/max(1,n_sets)*100:4.1f}%)")
    print(f"  loại đơn: {otypes}")
    print(f"  file: {len(files)} × {PER_FILE} đơn + README.md + sim-500-CLEANUP.sql")


if __name__ == "__main__":
    main()
