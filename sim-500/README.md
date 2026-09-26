# SIM-500 — BỘ DỮ LIỆU MÔ PHỎNG 500 ĐƠN (MODULE LÊN KẾ HOẠCH SẢN XUẤT)

Ngày tạo: **26/09/2026** · Seed `20260926` · **BỘ DỮ LIỆU BACKLOG SẠCH** — để **tập làm kế hoạch từ đầu**:
cả 500 đơn đã xác nhận, **chưa bộ nào được xếp lịch, chưa bộ nào đang sản xuất, không có làm lại**.

## 1. Nội dung

| Hạng mục | Số lượng |
|---|---|
| Đơn hàng | **500** (chia 10 file × 50 đơn) |
| Dòng bộ cửa (mỗi dòng = 1 Bộ số) | 1056 (tối đa 5 dòng/đơn) |
| Dòng thuộc đơn đã xác nhận (vào kế hoạch) | 1056 |
| **Bộ trong kế hoạch** (`production_sets`) | **1056** — mỗi dòng đúng 1 bộ |
| Tổng số bộ theo số lượng | **2280** (mỗi dòng ≤ 10 bộ) |
| Lệnh con Cánh/Khung/Phào | 3168 (3 lệnh/bộ) |
| Công đoạn (`production_tasks`) | 1056 × 24 (tuỳ danh mục cũ/mới, luôn 24 dòng/bộ) |
| Câu hỏi xác nhận | 3000 |

- **Ngày đặt hàng:** 01/10/2026 → 10/11/2026 — **trong tháng 10–11/2026**.
- **Ngày giao khách:** **trong tháng 10–11/2026**, muộn nhất **30/11/2026**, và luôn **≥ 15 ngày** sau ngày đặt.
- **Loại đơn:** SAN_XUAT 329 · MAU 126 · LAM_LAI 45.
- **Đơn nháp:** 0 — đã tắt, cả 500 đơn đều `DA_XAC_NHAN` nên **đưa vào kế hoạch được ngay**.

## 2. Trạng thái — **TẤT CẢ LÀ BACKLOG**

| Trạng thái bộ | Số bộ | Ngày kế hoạch | Tiến độ |
|---|---|---|---|
| **CHO_XEP_LICH** (chờ xếp lịch) | 1056 | *chưa gán* | 0% |

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
