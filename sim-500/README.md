# SIM-500 — BỘ DỮ LIỆU MÔ PHỎNG 500 ĐƠN (MODULE LÊN KẾ HOẠCH SẢN XUẤT)

Ngày tạo: **26/09/2026** · Seed `20260926` · Dùng cho thử tải và xem **BACKLOG / WIP / ĐANG DỞ / TRỄ / ĐÃ GIAO**.

## 1. Nội dung

| Hạng mục | Số lượng |
|---|---|
| Đơn hàng | **500** (chia 10 file × 50 đơn) |
| Dòng bộ cửa (mỗi dòng = 1 Bộ số) | 1053 (tối đa 5 dòng/đơn) |
| Dòng thuộc đơn đã xác nhận (vào kế hoạch) | 1006 |
| **Bộ trong kế hoạch** (`production_sets`) | **1006** — mỗi dòng đúng 1 bộ |
| Tổng số bộ theo số lượng | **2075** (mỗi dòng ≤ 10 bộ) |
| Lệnh con Cánh/Khung/Phào | 3018 (3 lệnh/bộ) |
| Công đoạn (`production_tasks`) | 1006 × 24 (tuỳ danh mục cũ/mới, luôn 24 dòng/bộ) |
| Câu hỏi xác nhận | 3000 |

- **Ngày đặt hàng:** 10/08/2026 → 05/10/2026 · **Ngày giao:** luôn **≥ 15 ngày** sau ngày đặt (15–45 ngày).
- **Loại đơn:** SAN_XUAT 346 · MAU 106 · LAM_LAI 48.
- **Đơn nháp (`status='NHAP'`):** 20 đơn (~4%) — **không có Bộ số, không có bộ trong kế hoạch** (đúng như app).

## 2. Phân bố trạng thái bộ cửa (theo độ cũ của đơn so với 26/09/2026)

| Scenario | Trạng thái bộ | Số bộ |
|---|---|---|
| BACKLOG | CHO_XEP_LICH (chờ xếp lịch) | 221 |
| SCHEDULED | DA_XEP_LICH | 181 |
| WIP | DANG_SX | 302 |
| PAUSED | TAM_DUNG (có `reason_code`) | 50 |
| DONE | HOAN_THANH | 91 |
| DELIVERED | DA_GIAO (OTD ≈ 70%) | 141 |
| CANCELLED | HUY | 20 |

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
  - Trạng thái suy theo `seq`: `seq <= done_seq` → XONG; bước đang làm → DANG_LAM (hoặc TAM_DUNG nếu bộ tạm dừng);
    còn lại CHUA_LAM. Bộ BACKLOG/HUY/DA_XEP_LICH → tất cả CHUA_LAM; HOAN_THANH/DA_GIAO → tất cả XONG.
  - `planned_start/planned_end` = ngày kế hoạch của bước (bộ + offset bước, **không rơi vào Chủ nhật**).
  - ~3% công đoạn XONG có `is_rework=true` + `reason_code` nhóm `LOI`; task TAM_DUNG có lý do nhóm tạm dừng;
    `assignee` là tên tổ trưởng; `updated_by='Mô phỏng'`.
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
