#!/usr/bin/env python3
"""
Xuất dữ liệu mô phỏng ra 1 file .sql CẦM THEO ĐƯỢC (không kèm id):
nạp được vào bất kỳ DB nào đã có bảng của app (kể cả DB đang có đơn thật).

Ghép bản ghi theo KHOÁ TỰ NHIÊN, không theo id:
  sales_orders                ← order_code
  sales_order_items           ← (order_code, line_no)
  sales_order_item_details    ← (order_code, line_no, row_order)
  sales_order_requirements    ← (order_code, code)
  production_sets             ← (order_code, set_no)
  production_component_orders ← (order_code, set_no, kind)
  production_tasks            ← (order_code, set_no, stage_code, scope)
"""
import csv, io, os, re, subprocess, sys

PSQL = ["psql", "-h", "localhost", "-U", "door_app", "-d", "door_production_test"]
ENV = {**os.environ, "PGPASSWORD": "test123"}
OUT = "/home/user/.workspace/src/artifacts/sim-1000-don.sql"
TYPES = {}

ORD_COLS = ["order_code", "order_type", "status", "customer_code", "customer_name", "sales_employee_code",
            "order_date", "required_delivery_date", "receiver_name", "receiver_phone", "receiver_address",
            "delivery_km", "region", "group_no", "excel_update_date", "shipping_fee",
            "shipping_mountain_district", "subtotal", "discount_percent", "discount_amount",
            "total_after_discount", "deposit_amount", "warehouse_receipt_deduction", "delivery_payment",
            "created_at", "updated_at"]
IT_COLS = ["line_no", "set_no", "product_name", "product_code", "model", "opening_direction",
           "trim_direction", "paint_color", "height_mm", "width_mm", "frame_mm", "clear_height_mm",
           "clear_width_mm", "panel_info", "trim_bars_per_set", "trim_type", "lock_model", "window_bars",
           "leaves_per_set", "quantity", "unit", "pricing_quantity", "unit_price", "amount", "note",
           "image_path", "source_row", "created_at", "updated_at"]
DT_COLS = ["row_order", "detail_type", "product_name", "product_code", "model", "height_mm", "width_mm",
           "unit", "pricing_quantity", "unit_price", "amount", "created_at", "updated_at"]
RQ_COLS = ["code", "question_text", "answer", "note", "sort_order", "created_at", "updated_at"]
PL_COLS = ["code", "from_date", "to_date", "status", "created_by", "approved_by", "approved_at", "note",
           "created_at", "updated_at"]
SE_COLS = ["set_no", "order_type", "customer_name", "product_name", "model", "opening_direction",
           "paint_color", "veneer_code", "height_mm", "width_mm", "leaves_per_set", "trim_bars_per_set",
           "quantity", "pricing_quantity", "canh_equivalent", "due_date", "priority", "status",
           "percent_done", "planned_start", "planned_end", "actual_completed_at", "actual_delivered_at",
           "program_ready", "material_ready", "pack_count", "note", "created_at", "updated_at"]
CO_COLS = ["kind", "qty_expected", "note", "created_at", "updated_at"]
TK_COLS = ["stage_code", "scope", "stage_kind", "seq", "work_center_code", "status", "qty_expected",
           "qty_done", "planned_start", "planned_end", "actual_start", "actual_end", "assignee",
           "is_rework", "rework_from_stage", "reason_code", "note", "updated_by", "created_at", "updated_at"]

NUMERIC_LIKE = {"line_no", "row_order", "sort_order", "group_no", "seq", "priority", "percent_done",
                "quantity", "leaves_per_set", "trim_bars_per_set", "height_mm", "width_mm", "frame_mm",
                "clear_height_mm", "clear_width_mm", "image_width", "image_height", "pack_count",
                "pricing_quantity", "unit_price", "amount", "qty_expected", "qty_done", "delivery_km",
                "shipping_fee", "subtotal", "discount_percent", "discount_amount", "total_after_discount",
                "deposit_amount", "warehouse_receipt_deduction", "delivery_payment", "source_row",
                "canh_equivalent"}
BOOL_LIKE = {"is_rework", "program_ready", "material_ready", "shipping_mountain_district"}


def dump(sql):
    r = subprocess.run(PSQL + ["-tAc", f"COPY ({sql}) TO STDOUT WITH CSV"], capture_output=True,
                       text=True, env=ENV)
    if r.returncode:
        sys.exit("psql lỗi:\n" + r.stderr[:600])
    return list(csv.reader(io.StringIO(r.stdout)))


TYPE_MAP = {"integer": "int", "bigint": "bigint", "character varying": "varchar", "text": "text",
            "date": "date", "timestamp without time zone": "timestamp", "timestamp with time zone": "timestamptz",
            "boolean": "boolean", "numeric": "numeric", "double precision": "float8", "jsonb": "jsonb",
            "character": "char"}


BASE_TYPES = {"order_code": "varchar", "line_no": "int", "set_no": "varchar",
              "plan_code": "varchar", "code": "varchar"}


def use(*tables):
    """Nạp bảng kiểu của (các) bảng sắp ghi — PHẢI gọi trước mỗi khối INSERT."""
    TYPES.clear()
    TYPES.update(BASE_TYPES)
    for t in tables:
        TYPES.update(types_of(t))


def types_of(table):
    """Kiểu dữ liệu Postgres của từng cột — cần để VALUES không bị suy thành text khi cột toàn NULL."""
    r = subprocess.run(PSQL + ["-tAc",
        "select column_name||'|'||data_type from information_schema.columns "
        f"where table_schema='public' and table_name='{table}'"], capture_output=True, text=True, env=ENV)
    out = {}
    for line in r.stdout.strip().splitlines():
        if "|" in line:
            c, t = line.split("|", 1)
            out[c] = TYPE_MAP.get(t, "text")
    return out


def alias(cols, extra=None):
    """Danh sách TÊN cột cho alias của VALUES (Postgres không cho kèm kiểu ở đây —
    nên cột toàn NULL được ép kiểu ngay tại giá trị, xem `val`)."""
    return ", ".join((extra or []) + cols)


def val(c, v, force=None):
    """Ép kiểu cho NULL (cột toàn NULL) và cho cột ngày/giờ (literal không có kiểu sẽ bị
    Postgres suy thành text). Số và chuỗi để nguyên — nhỏ file hơn nhiều."""
    t = force or TYPES.get(c, "text")
    if v is None or v == "":
        return "NULL::" + t
    if c in BOOL_LIKE:
        return "true" if v in ("t", "true", "True") else "false"
    if c in NUMERIC_LIKE:
        return v
    if t in ("date", "timestamp", "timestamptz"):
        return "'" + v.replace("'", "''") + "'::" + t
    return "'" + v.replace("'", "''") + "'"


def vals(cols, row):
    return "(" + ",".join(val(c, v) for c, v in zip(cols, row)) + ")"


def rows_values(cols, rows, chunk=4000):
    """(VALUES (...),(...)) AS v(cols...) — chia lô để câu lệnh không quá to."""
    out = []
    for k in range(0, len(rows), chunk):
        part = rows[k:k + chunk]
        out.append("\n  " + ",\n  ".join(vals(cols, r) for r in part) + "\n")
    return out


def main():
    orders = dump("""select order_code,order_type,status,customer_code,customer_name,sales_employee_code,
        order_date,required_delivery_date,receiver_name,receiver_phone,receiver_address,delivery_km,region,
        group_no,excel_update_date,shipping_fee,shipping_mountain_district,subtotal,discount_percent,
        discount_amount,total_after_discount,deposit_amount,warehouse_receipt_deduction,delivery_payment,
        created_at,updated_at from sales_orders order by order_code""")
    items = dump("""select o.order_code, i.line_no, i.set_no, i.product_name, i.product_code, i.model,
        i.opening_direction, i.trim_direction, i.paint_color, i.height_mm, i.width_mm, i.frame_mm,
        i.clear_height_mm, i.clear_width_mm, i.panel_info, i.trim_bars_per_set, i.trim_type, i.lock_model,
        i.window_bars, i.leaves_per_set, i.quantity, i.unit, i.pricing_quantity, i.unit_price, i.amount,
        i.note, i.image_path, i.source_row, i.created_at, i.updated_at
        from sales_order_items i join sales_orders o on o.id=i.order_id order by o.order_code, i.line_no""")
    details = dump("""select o.order_code, i.line_no, d.row_order, d.detail_type, d.product_name,
        d.product_code, d.model, d.height_mm, d.width_mm, d.unit, d.pricing_quantity, d.unit_price,
        d.amount, d.created_at, d.updated_at
        from sales_order_item_details d join sales_order_items i on i.id=d.order_item_id
        join sales_orders o on o.id=i.order_id order by o.order_code, i.line_no, d.row_order""")
    reqs = dump("""select o.order_code, r.code, r.question_text, r.answer, r.note, r.sort_order,
        r.created_at, r.updated_at from sales_order_requirements r
        join sales_orders o on o.id=r.order_id order by o.order_code, r.sort_order""")
    plans = dump("""select code,from_date,to_date,status,created_by,approved_by,approved_at,note,
        created_at,updated_at from production_plans order by code""")
    sets = dump("""select o.order_code, i.line_no, s.set_no, s.order_type, s.customer_name, s.product_name,
        s.model, s.opening_direction, s.paint_color, s.veneer_code, s.height_mm, s.width_mm,
        s.leaves_per_set, s.trim_bars_per_set, s.quantity, s.pricing_quantity, s.canh_equivalent,
        s.due_date, s.priority, s.status, s.percent_done, s.planned_start, s.planned_end,
        s.actual_completed_at, s.actual_delivered_at, s.program_ready, s.material_ready, s.pack_count,
        s.note, s.created_at, s.updated_at, p.code
        from production_sets s join sales_orders o on o.id=s.order_id
        left join sales_order_items i on i.order_id=s.order_id and i.set_no=s.set_no
        left join production_plans p on p.id=s.plan_id order by o.order_code, s.set_no""")
    comps = dump("""select o.order_code, s.set_no, c.kind, c.qty_expected, c.note, c.created_at, c.updated_at
        from production_component_orders c join production_sets s on s.id=c.set_id
        join sales_orders o on o.id=s.order_id order by o.order_code, s.set_no, c.kind""")
    tasks = dump("""select o.order_code, i.line_no, s.set_no, t.stage_code, t.scope, t.stage_kind, t.seq,
        t.work_center_code, t.status, t.qty_expected, t.qty_done, t.planned_start, t.planned_end,
        t.actual_start, t.actual_end, t.assignee, t.is_rework, t.rework_from_stage, t.reason_code,
        t.note, t.updated_by, t.created_at, t.updated_at
        from production_tasks t join production_sets s on s.id=t.set_id
        join sales_orders o on o.id=s.order_id
        left join sales_order_items i on i.order_id=s.order_id and i.set_no=s.set_no
        order by o.order_code, s.set_no, t.seq""")

    L = ["""-- ============================================================================
-- GOLDMAX · DỮ LIỆU MÔ PHỎNG MODULE LÊN KẾ HOẠCH SẢN XUẤT
--   1000 đơn   ·   2680 bộ cửa   ·   phân bố qua mọi công đoạn
--   (chờ xếp lịch 25% · đã xếp lịch 22% · đang sản xuất 27% · tạm dừng 5% ·
--    xong chưa giao 8% · đã giao 12% · đã huỷ 1%; giao đúng hạn ~70%)
--
-- CÁCH DÙNG (nên nạp vào DB mô phỏng riêng):
--     psql "<CHUỖI KẾT NỐI>" -f sim-1000-don.sql
--
-- YÊU CẦU: DB đã chạy migration của app (bảng đã có) + đã seed danh mục sản xuất
--          (production_stages / production_work_centers / production_reasons).
-- KHÔNG kèm id nên nạp được vào DB đang có đơn thật.
-- Gỡ bỏ: chạy sim-1000-don-CLEANUP.sql
-- ============================================================================
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE _sim_o (order_code varchar(120) PRIMARY KEY, id int) ON COMMIT DROP;
CREATE TEMP TABLE _sim_i (order_code varchar(120), line_no int, id int) ON COMMIT DROP;
CREATE TEMP TABLE _sim_s (order_code varchar(120), set_no varchar(80), id int) ON COMMIT DROP;
CREATE TEMP TABLE _sim_p (code varchar(60) PRIMARY KEY, id int) ON COMMIT DROP;
"""]

    # 1. ĐƠN HÀNG
    use("sales_orders")
    for blk in rows_values(ORD_COLS, orders):
        L.append("INSERT INTO sales_orders (" + ",".join(ORD_COLS) + ") VALUES" + blk + ";")
    for k in range(0, len(orders), 2000):
        part = orders[k:k + 2000]
        L.append("INSERT INTO _sim_o (order_code, id) SELECT o.order_code, o.id FROM sales_orders o JOIN (VALUES\n  "
                 + ",\n  ".join("(" + val("order_code", r[0], "varchar") + ")" for r in part)
                 + "\n) AS v(order_code) ON v.order_code = o.order_code;")

    # 2. BỘ CỬA
    use("sales_order_items")
    it = ["order_code"] + IT_COLS
    for blk in rows_values(it, items):
        L.append("INSERT INTO sales_order_items (order_id," + ",".join(IT_COLS) + ")\nSELECT _sim_o.id,"
                 + ",".join("v." + c for c in IT_COLS) + "\nFROM (VALUES" + blk + ") AS v(" + alias(IT_COLS, ["order_code"]) + ")\n"
                 "JOIN _sim_o ON _sim_o.order_code = v.order_code;")
    use()
    L.append("INSERT INTO _sim_i (order_code, line_no, id)\nSELECT v.order_code, v.line_no, i.id FROM (VALUES\n  "
             + ",\n  ".join("(" + val("order_code", r[0], "varchar") + "," + val("line_no", r[1], "int") + ")" for r in items)
             + "\n) AS v(order_code, line_no)\nJOIN _sim_o ON _sim_o.order_code = v.order_code\n"
             "JOIN sales_order_items i ON i.order_id = _sim_o.id AND i.line_no = v.line_no;")

    # 3. HÀNG KÈM
    use("sales_order_item_details")
    dt = ["order_code", "line_no"] + DT_COLS
    for blk in rows_values(dt, details):
        L.append("INSERT INTO sales_order_item_details (order_item_id," + ",".join(DT_COLS) + ")\nSELECT _sim_i.id,"
                 + ",".join("v." + c for c in DT_COLS) + "\nFROM (VALUES" + blk + ") AS v(" + alias(DT_COLS, ["order_code", "line_no"]) + ")\n"
                 "JOIN _sim_i ON _sim_i.order_code = v.order_code AND _sim_i.line_no = v.line_no;")

    # 4. CÂU HỎI XÁC NHẬN
    use("sales_order_requirements")
    rq = ["order_code"] + RQ_COLS
    for blk in rows_values(rq, reqs):
        L.append("INSERT INTO sales_order_requirements (order_id," + ",".join(RQ_COLS) + ")\nSELECT _sim_o.id,"
                 + ",".join("v." + c for c in RQ_COLS) + "\nFROM (VALUES" + blk + ") AS v(" + alias(RQ_COLS, ["order_code"]) + ")\n"
                 "JOIN _sim_o ON _sim_o.order_code = v.order_code;")

    # 5. KẾ HOẠCH TUẦN
    use("production_plans")
    if plans:
        L.append("INSERT INTO production_plans (" + ",".join(PL_COLS) + ") VALUES\n  "
                 + ",\n  ".join(vals(PL_COLS, r) for r in plans) + ";")
        L.append("INSERT INTO _sim_p (code, id) SELECT v.code, p.id FROM (VALUES\n  "
                 + ",\n  ".join("(" + val("code", r[0], "varchar") + ")" for r in plans) + "\n) AS v(code)\n"
                 "JOIN production_plans p ON p.code = v.code;")

    # 6. BỘ ĐƯA VÀO KẾ HOẠCH
    use("production_sets")
    se = ["order_code", "line_no"] + SE_COLS + ["plan_code"]
    head = ("INSERT INTO production_sets (order_id,order_item_id,plan_id," + ",".join(SE_COLS) + ")\n"
            "SELECT _sim_o.id,\n"
            "       (SELECT i.id FROM _sim_i i WHERE i.order_code = v.order_code AND i.line_no = v.line_no),\n"
            "       _sim_p.id,\n       " + ",".join("v." + c for c in SE_COLS) + "\nFROM (VALUES")
    tail = (") AS v(" + alias(se) + ")\nJOIN _sim_o ON _sim_o.order_code = v.order_code\n"
            "LEFT JOIN _sim_p ON _sim_p.code = v.plan_code;")
    for blk in rows_values(se, sets):
        L.append(head + blk + tail)
    use()
    L.append("INSERT INTO _sim_s (order_code, set_no, id)\nSELECT v.order_code, v.set_no, s.id FROM (VALUES\n  "
             + ",\n  ".join("(" + val("order_code", r[0], "varchar") + "," + val("set_no", r[2], "varchar") + ")" for r in sets)
             + "\n) AS v(order_code, set_no)\nJOIN _sim_o ON _sim_o.order_code = v.order_code\n"
             "JOIN production_sets s ON s.order_id = _sim_o.id AND s.set_no = v.set_no;")

    # 7. LỆNH CON
    use("production_component_orders")
    co = ["order_code", "set_no"] + CO_COLS
    for blk in rows_values(co, comps):
        L.append("INSERT INTO production_component_orders (set_id," + ",".join(CO_COLS) + ")\nSELECT _sim_s.id,"
                 + ",".join("v." + c for c in CO_COLS) + "\nFROM (VALUES" + blk + ") AS v(" + alias(CO_COLS, ["order_code", "set_no"]) + ")\n"
                 "JOIN _sim_s ON _sim_s.order_code = v.order_code AND _sim_s.set_no = v.set_no;")

    # 8. CÔNG ĐOẠN
    use("production_tasks")
    tk = ["order_code", "line_no", "set_no"] + TK_COLS
    thead = ("INSERT INTO production_tasks (set_id,order_item_id," + ",".join(TK_COLS) + ")\n"
             "SELECT _sim_s.id,\n"
             "       (SELECT i.id FROM _sim_i i WHERE i.order_code = v.order_code AND i.line_no = v.line_no),\n"
             "       " + ",".join("v." + c for c in TK_COLS) + "\nFROM (VALUES")
    ttail = (") AS v(" + alias(TK_COLS, ["order_code", "line_no", "set_no"]) + ")\n"
             "JOIN _sim_s ON _sim_s.order_code = v.order_code AND _sim_s.set_no = v.set_no;")
    for blk in rows_values(tk, tasks, chunk=3000):
        L.append(thead + blk + ttail)

    # 9. BỘ ĐẾM BỘ SỐ
    maxset = max(int(re.sub(r"\D", "", r[2]) or 0) for r in sets)
    L.append(f"""-- Đẩy bộ đếm Bộ số để đơn thật sau này không trùng số mô phỏng
INSERT INTO system_settings (key, value, created_at, updated_at)
VALUES ('ORDER_SET_NUMBER_COUNTER', '{maxset}', now(), now())
ON CONFLICT (key) DO UPDATE
   SET value = GREATEST(system_settings.value::bigint, EXCLUDED.value::bigint)::text,
       updated_at = now();

COMMIT;

-- ── Kiểm tra sau khi nạp ──
--   select count(*) from sales_orders;                       -- 1000
--   select status, count(*) from production_sets group by 1; -- 7 nhóm trạng thái
--   select count(*) from production_tasks;                   -- 53904
""")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sql = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(sql)
    print(f"✔ {OUT}  ({len(sql)/1e6:.1f} MB)")
    print(f"  đơn={len(orders)} bộ={len(items)} kèm={len(details)} câu hỏi={len(reqs)} "
          f"kế hoạch={len(plans)} set={len(sets)} lệnh con={len(comps)} công đoạn={len(tasks)}")


if __name__ == "__main__":
    main()
