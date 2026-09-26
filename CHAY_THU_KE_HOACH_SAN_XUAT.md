# CHẠY THỬ MODULE KẾ HOẠCH SẢN XUẤT — CÁC BƯỚC

*Dành cho: người lên kế hoạch · văn phòng xưởng. Mốc: 26/09/2026.*
*Liên quan: `HUONG_DAN_TAO_LENH_SAN_XUAT_V137.md` (tạo lệnh chi tiết) · `sim-500/README.md` (dữ liệu mô phỏng).*

> **Khác biệt quan trọng:** bộ dữ liệu **SIM-500 đã tạo sẵn bộ + công đoạn** trong kế hoạch ⇒
> nạp xong là **xem và thao tác được ngay** (không cần "đưa vào kế hoạch").
> Còn **đơn mới bạn tự tạo** thì phải qua bước **đưa vào kế hoạch** (mục 2B).
>
> **V141 — đã BỎ chế độ “Xếp lịch tự động”.** Lịch giờ gán **bằng tay**: mở một bộ → điền **“Ngày KH”**
> cho từng công đoạn → **Lưu tiến độ**. Xem `BO_XEP_LICH_TU_DONG_V141.md`.

---

## 0. Kiểm tra trước khi bắt đầu

**0.1. Kiểm tra đã nạp đủ dữ liệu** (chạy trong SQL Editor hoặc psql):
```sql
SELECT (SELECT count(*) FROM sales_orders)                       AS don,
       (SELECT count(*) FROM production_sets)                    AS bo,
       (SELECT count(*) FROM production_component_orders)         AS lenh_con,
       (SELECT count(*) FROM production_tasks)                    AS cong_doan;
-- SIM-500 đầy đủ: don = 500 · bo = 1006 · lenh_con = 3018 · cong_doan = 24144
```

**0.2. Vào cấu hình một lượt** — menu trái → *Kế hoạch sản xuất → Cấu hình sản xuất*:

| Tab | Kiểm gì |
|---|---|
| **Cấu hình chung** | Ngày làm việc (T2–T7) · ca/ngày · giờ/ca · Đệm giao hàng · Ngưỡng vàng/đỏ (cánh/ngày) · Loại đơn đưa vào kế hoạch · Điều kiện đủ thông tin mới xếp lịch |
| **Tổ & năng lực** | Mỗi tổ có **Năng lực/ngày**. Nếu đã chạy V140: có thêm **Tổ thiết kế** (năng lực để trống = chưa khai) |
| **Công đoạn** | 12 công đoạn tách phần (Cắt/Chấn/Hàn/Vân × cánh·khung·phào) + **Năng lực/ngày** riêng từng công đoạn (để trống = theo tổ) |
| **Chương trình máy cắt** | Model nào **đã có chương trình** ⇒ công đoạn Bồi Lares tự **Bỏ qua** |
| **Ngày nghỉ** | Ngày lễ để app không xếp lịch vào |

---

## 1. Xem ngay sau khi nạp SIM-500

Menu trái → **Kế hoạch sản xuất**. Bạn sẽ thấy:

| Chỉ số trên màn | Giá trị kỳ vọng (SIM-500) |
|---|---|
| Bộ trong kế hoạch | **1.006** |
| Chờ xếp lịch (BACKLOG) | **221** |
| Đang sản xuất (WIP) | **302** |
| Hoàn thành / đã giao | **91 / 141** |
| Tạm dừng | **50** |
| Chưa nhập vào kế hoạch | **0** (vì SIM-500 đã tạo bộ) |

Cuộn xuống xem **bảng "Tải theo tổ và ngày"** — đỏ = vượt năng lực, vàng > 85%;
mỗi tổ có **dòng con `↳ <công đoạn>`** (năng lực riêng từng công đoạn).

---

## 2A. Chạy thử với dữ liệu SIM-500 (làm được ngay)

| # | Việc | Ở đâu / bấm gì | Kỳ vọng |
|---|---|---|---|
| 1 | **Gán ngày KH bằng tay** | Danh sách **“Bộ chờ xếp lịch”** → bấm **Bộ số** → ở bảng công đoạn điền ô **“Ngày KH”** cho từng công đoạn → **Lưu tiến độ** | Bộ có ngày kế hoạch; cột “Xếp lịch” + bảng tải cập nhật theo. Công đoạn cùng một bước (Cắt cánh / Cắt khung / Cắt phào) nên gán **cùng ngày** |
| 2 | **Xem tải** | Bảng **“Tải theo tổ và ngày”** | Xanh = trong năng lực, vàng > 85%, đỏ = vượt. Dòng con `↳ <công đoạn>` dùng **năng lực riêng từng công đoạn** (để trống = theo tổ). SIM-500 là dữ liệu *thử tải* nên sẽ có ô đỏ |
| 3 | **Mở 1 bộ đang sản xuất** | Danh sách **"Đang sản xuất"** → bấm vào Bộ số | Trang bộ cửa: 3 lệnh con + bảng **"Cập nhật tiến độ theo công đoạn"** |
| 4 | **Thử cổng điều kiện** | Ở bộ đang dở, thử đặt *Xong* cho **Test cơ khí** khi chưa hàn đủ 3 phần | Dòng hiện **🔒 chờ …** và không chọn được → đúng luật (app **chặn**, không chỉ cảnh báo) |
| 5 | **Thử tạm dừng + lý do** | Chọn *Tạm dừng* một công đoạn → chọn **Lý do** (vd *Chờ phôi*) → **Lưu tiến độ** | Bộ chuyển **Tạm dừng**; KPI "Tạm dừng" tăng |
| 6 | **Sửa số lượng lệnh con** | Khối **"Số lượng lệnh con (sửa tay được)"** → sửa Cánh/Khung/Phào → **Lưu tiến độ** | Số công thức hiện vàng khi bạn sửa khác |
| 7 | **Đánh dấu đã giao** | Nút **"Đánh dấu đã giao"** + ngày | Bộ → *Đã giao*, dùng tính OTD |
| 8 | **Kế hoạch tuần** | *Kế hoạch sản xuất → Kế hoạch tuần* → chọn tuần → **"Tạo / gom bộ vào kế hoạch"** → nhập tên giám đốc → **"Chốt kế hoạch"** | Thẻ kế hoạch `KH-<yyyymmdd>-<yyyymmdd>` |
| 9 | **In cho xưởng** | *Kế hoạch sản xuất → "In phiếu lệnh SX"* → chọn ngày + tổ | **Phiếu lệnh A4** (mỗi bộ/tổ 1 trang) và **Danh sách việc theo ngày** để dán xưởng. Bấm **In / Lưu PDF** |
| 10 | **Xem báo cáo** | *Báo cáo → Sản xuất (OTD)* | OTD **≈ 70,2%** · năng suất & tải theo tổ · thời gian thực tế vs định mức từng công đoạn · tỷ lệ làm lại **≈ 2,9%** · lý do trễ · tồn thành phẩm |

> **Bộ mô phỏng không tạo `production_plans`** ⇒ nếu màn *Kế hoạch tuần* đang trống thì bấm **"Tạo / gom bộ vào kế hoạch"** là có.

---

## 2B. Với ĐƠN MỚI (đơn bạn tự tạo hoặc nhập sau này)

**Bước 1 — Tạo & LƯU đơn**: *Tạo đơn hàng* → chọn **Loại đơn** (Sản xuất / Mẫu / Làm lại) → nhập dòng bộ cửa
(cao, rộng, hướng mở, màu sơn, số cánh…) → bấm **Lưu đơn hàng** (KHÔNG phải "Lưu nháp").
Khi lưu, app mới **cấp Bộ số** và đơn mới thành **ĐÃ XÁC NHẬN** — điều kiện để vào kế hoạch.

**Bước 2 — Đưa vào kế hoạch** (1 trong 3 cách):

| Cách | Thao tác | Khi nào dùng |
|---|---|---|
| **A. Từ trang Kế hoạch sản xuất** | Link/nút **"Nhập bộ đang sản xuất dở (N)"** → chọn bộ → **"Đưa N bộ đã chọn vào kế hoạch"**; hoặc **"Đưa TẤT CẢ vào kế hoạch"** | Hằng ngày / nhập lô lớn |
| **B. Từ trang đơn hàng** | *Quản lý đơn hàng* → mở đơn **ĐÃ XÁC NHẬN** → nút **"Tạo lệnh sản xuất"** (cạnh *Sửa đơn*) | Tạo lệnh cho đúng 1 đơn |
| **C. Hàng loạt bằng API** (khi cần đẩy nhiều) | Xem lệnh `curl` bên dưới | Nhập 100–500 đơn một lúc |

**Bước 3 — Gán ngày kế hoạch (xếp lịch bằng tay)**: mở từng bộ (hoặc bộ chờ xếp lịch) → điền **“Ngày KH”** cho từng công đoạn → **Lưu tiến độ**. Ngày của bộ tự suy = min/max ngày công đoạn.

App tự sinh: **1 lệnh CHA (bộ cửa) + 3 lệnh CON (cánh·khung·phào) + 24 công đoạn**. Không nhập tay công đoạn.

### Lệnh API khi cần làm hàng loạt
```bash
# Đưa TẤT CẢ bộ của đơn đã xác nhận (chưa có lệnh) vào kế hoạch
curl -X POST "$APP_URL/api/production/sets" -H 'Content-Type: application/json' -d '{}'

# Chỉ định vài đơn / vài dòng hàng
curl -X POST "$APP_URL/api/production/sets" -H 'Content-Type: application/json' \
     -d '{"orderIds":[14,15],"limit":500}'

# Gán ngày kế hoạch cho từng công đoạn (xếp lịch BẰNG TAY — V141 đã bỏ xếp lịch tự động)
curl -X POST "$APP_URL/api/production/sets/<id>" -H 'Content-Type: application/json' \
     -d '{"action":"update","tasks":[{"id":123,"plannedStart":"2026-09-28"},{"id":124,"plannedStart":"2026-09-28"}]}'

# Sinh lại công đoạn cho 1 bộ theo danh mục mới nhất (không có nút trên UI)
curl -X POST "$APP_URL/api/production/sets/<id>" -H 'Content-Type: application/json' -d '{"action":"rebuild"}'
```

---

## 3. Kiểm tra "đúng hay chưa" (checklist nhanh)

| Kiểm tra | Đúng khi |
|---|---|
| Bấm tạo lệnh **2 lần** | Lần 2 báo **bỏ qua** (không sinh trùng) |
| Bộ thiếu Cao/Rộng/Hướng mở/Màu sơn | Vẫn tạo lệnh, nhưng có **cảnh báo vàng** và **không xếp lịch** cho bộ đó |
| Xếp lịch | Không có công đoạn nào rơi **Chủ nhật**/ngày lễ |
| Cùng một bước của 1 bộ | Cắt cánh / Cắt khung / Cắt phào **cùng ngày** |
| Test cơ khí | Chỉ mở khi **cả 3 phần** đã hàn xong |
| Lắp kính + đóng gói | Chỉ mở khi **cả 3 phần** đã vân xong |
| Đóng gói báo Xong | Bộ tự chuyển **Hoàn thành** + ghi mốc hoàn thành sản xuất |
| Báo cáo Sản xuất | Có số (không hiện cảnh báo "chưa có mốc thực tế") |

---

## 4. ⚠️ Một lỗi đã biết (liên quan BACKLOG)

`deriveSetStatus()` trong `src/lib/production/catalog.ts` **không bao giờ trả về `CHO_XEP_LICH`**.
Hệ quả: mở một bộ đang **Chờ xếp lịch** rồi bấm **Lưu tiến độ** (dù chưa có ngày kế hoạch) → bộ đó tự
chuyển thành **Đã xếp lịch**, nên cột **BACKLOG** sẽ **mất dần** sau khi người dùng thao tác.
(Ghi nhận lần đầu ở `SIM_1000_DON.md`, mục 5.1.)

→ Muốn đúng thì phải truyền thêm "bộ đã có ngày kế hoạch hay chưa" vào `deriveSetStatus()`.
**Nói tôi biết nếu bạn muốn sửa** — sửa nhỏ, tôi làm kèm kiểm chứng.

---

## 5. Dọn dữ liệu thử khi xong

```bash
psql "$DATABASE_URL" -f sim-500/sim-500-CLEANUP.sql   # xoá đúng 500 mã đơn mô phỏng
```
Bộ đếm Bộ số (`system_settings.ORDER_SET_NUMBER_COUNTER`) **giữ nguyên** — muốn trả về giá trị cũ thì tự `UPDATE`.
