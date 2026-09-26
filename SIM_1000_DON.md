# BỘ DỮ LIỆU MÔ PHỎNG 1000 ĐƠN — MODULE LÊN KẾ HOẠCH SẢN XUẤT

Ngày tạo: **26/09/2026** · Số hiệu: **SIM-1000** · Dùng cho: thử tải, xem **backlog / WIP / đơn dở / trễ hạn**.

Dữ liệu bám sát **danh mục thật** trích từ 8 file Excel đơn hàng của nhà máy (sản phẩm, model, hướng mở,
phào, màu sơn, khoảng kích thước, hàng kèm khóa/kính/phào rời, đơn giá/m², định dạng mã đơn, tên đại lý theo tỉnh).

---

## 1. Có gì trong bộ dữ liệu

| Hạng mục | Số lượng |
|---|---|
| **Đơn hàng** | **1.000** |
| Dòng bộ cửa (mỗi dòng = 1 Bộ số) | 2.383 |
| **Tổng số BỘ** (gồm số lượng của từng dòng) | **2.680** — TB **2,7 bộ/đơn**, nhiều nhất **14 bộ** (nhỏ hơn 15) |
| Hàng kèm theo bộ (khóa / kính ô thoáng / phào rời) | 4.087 dòng |
| Câu hỏi xác nhận đơn | 6.000 |
| **Bộ trong kế hoạch sản xuất** | **2.246** |
| Lệnh con (Cánh / Khung / Phào) | 6.738 |
| **Công đoạn (việc)** | **53.904** |
| Kế hoạch tuần | 2 (tuần 21–27/09 và 28/09–04/10) |
| Tổng giá trị đơn hàng | ≈ **30,5 tỷ đồng** |

**Ngày đặt hàng:** 15/09/2026 → 09/10/2026 · **Ngày giao:** 23/09/2026 → 31/10/2026
(khoảng 6% là **đơn gấp** — hạn giao sát, để có bộ quá hạn).

**Loại đơn:** Sản xuất 694 · Hàng mẫu 202 · Làm lại 104 · **Đơn nháp 55** (nháp thì chưa có Bộ số — đúng như thật).

## 2. Phân bố đơn theo công đoạn (để xem WIP / backlog)

| Trạng thái bộ cửa | Số bộ | Ý nghĩa khi xem |
|---|---|---|
| **Chờ xếp lịch** | 25% | **BACKLOG** — đã có lệnh, chưa đưa vào kế hoạch |
| **Đã xếp lịch** | 22% | Đã có ngày kế hoạch, chưa làm |
| **Đang sản xuất** | 27% | **WIP / ĐƠN DỞ** — đang ở các công đoạn khác nhau (Cắt → Chấn → Hàn → Sơn → Vân → Lắp kính…) |
| **Tạm dừng** | 5% | Có ghi **lý do** thật (chờ phôi, chờ lô sơn, chờ kính, thiếu người, khách đổi…) |
| **Hoàn thành (chưa giao)** | 8% | Đóng gói xong, còn trong kho |
| **Đã giao** | 12% | Có ngày giao thực tế |
| **Đã huỷ** | 1% | |

- **Giao đúng hạn (OTD) ≈ 70%** — tương đương thực trạng nhà máy khảo sát (trễ ~75%), nên so sánh được.
- **Tỷ lệ làm lại ≈ 3,0%** công đoạn (đúng mốc thực tế).
- Mỗi công đoạn đã làm đều có **mốc Bắt đầu / Xong** thật → báo cáo mới có số: **~8,3 giờ/công đoạn**, **~11,6 ngày/bộ**.
- Thời gian cách nhau **1 ngày làm việc/công đoạn**, **nghỉ Chủ nhật** — giống lịch xưởng.

> ⚠️ Khi xếp lịch tự động cho 2.246 bộ, app báo ngày kết thúc **08/12/2027** — tức **quá tải rất lớn** so với
> năng lực hiện tại (45–50 cánh/ngày). Đây là dữ liệu tốt để **thử cảnh báo quá tải**, không phải kế hoạch thật.

## 3. Cách dùng

### Cách A — nạp vào DB mô phỏng (khuyên dùng)

```bash
# 1. Tạo DB mới + chạy migration của app
DATABASE_URL="<chuỗi kết nối DB mới>" DIRECT_URL="<chuỗi kết nối DB mới>" npx prisma migrate deploy

# 2. Nạp dữ liệu mô phỏng
psql "<chuỗi kết nối DB mới>" -f sim-1000-don.sql        # ~8 giây

# 3. Trỏ app vào DB đó rồi xem: Kế hoạch sản xuất · Kế hoạch tuần · Nhập dở dang · Báo cáo → Sản xuất (OTD)
```

### Cách B — gỡ bỏ

```bash
psql "<chuỗi kết nối>" -f sim-1000-don-CLEANUP.sql
```

File gỡ chỉ xoá **đúng 1.000 mã đơn mô phỏng** (kèm công đoạn, lệnh con, bộ, kế hoạch tuần) —
không đụng đơn thật. **Riêng bộ đếm Bộ số giữ nguyên**, muốn trả về giá trị cũ thì tự set lại:
`UPDATE system_settings SET value = '<số cũ>' WHERE key = 'ORDER_SET_NUMBER_COUNTER';`

> **KHÔNG nạp thẳng vào DB production** nếu bạn không muốn lẫn dữ liệu mô phỏng.

## 4. Sinh lại bộ khác (số đơn / khoảng ngày / tỉ lệ khác)

```bash
cd scripts/simulation

# 1. sinh đơn (payload JSON) — đổi số đơn, seed, khoảng ngày
python3 gen.py --n 2000 --seed 12345 --from-date 2026-09-15 --to-date 2026-10-10 --out payloads.jsonl

# 2. nạp vào app đang chạy (đúng API tạo đơn thật, tự cấp Bộ số)
python3 post.py

# 3. đồng bộ sang module kế hoạch + xếp lịch
curl -X POST http://localhost:3000/api/production/sets     -H 'Content-Type: application/json' -d '{}'
curl -X POST http://localhost:3000/api/production/schedule -H 'Content-Type: application/json' -d '{"rescheduleAll":true}'

# 4. mô phỏng tiến độ theo công đoạn (backlog/WIP/tạm dừng/xong/đã giao)
python3 simulate.py --seed 20260926 --today 2026-09-26

# 5. nạp file CSV kết quả vào DB
psql "<chuỗi kết nối>" -f /tmp/sim/load.sql

# 6. xuất lại file .sql cầm theo được
python3 export_sql.py
```

Tỉ lệ phân bố công đoạn sửa ở bảng `BUCKETS` trong `simulate.py`; tỉ lệ làm lại ở dòng
`rng.random() < 0.07`; tỉ lệ đơn gấp ở `gen.py` (dòng `rng.random() < 0.06`).

## 5. Hai điều cần biết (phát hiện khi làm bộ dữ liệu này)

1. **`CHO_XEP_LICH` (chờ xếp lịch) sẽ tự đổi thành `DA_XEP_LICH`** ngay khi có ai đó bấm Lưu
   ở trang bộ cửa — kể cả khi bộ **chưa có ngày kế hoạch**.
   Nguyên nhân: `deriveSetStatus()` trong `src/lib/production/catalog.ts` chỉ trả về
   `DA_XEP_LICH` hoặc giữ nguyên trạng thái cũ, **không bao giờ trả về `CHO_XEP_LICH`**.
   Hệ quả: cột "Chờ xếp lịch" (backlog) trên bảng kế hoạch sẽ **mất dần** sau khi người dùng
   thao tác. Đã kiểm chứng bằng cách nhờ chính API của app tính lại 6 bộ mỗi loại:
   **36/36 bộ khớp** ở mọi trạng thái khác, **6/6 bộ chờ xếp lịch bị đổi thành đã xếp lịch**.
   → Nên sửa: truyền thêm "có ngày kế hoạch hay chưa" vào `deriveSetStatus()`.

2. **`prisma migrate` KHÔNG đọc `.env.local`.** Lệnh CLI của Prisma chỉ đọc `.env` — mà `.env`
   của dự án đang trỏ **DB production**. Vì vậy khi chạy migration cho DB test **phải truyền
   biến môi trường tường minh**:
   ```bash
   DATABASE_URL="postgresql://...test" DIRECT_URL="postgresql://...test" npx prisma migrate deploy
   ```

---

## 6. Danh mục thật đã dùng để sinh dữ liệu

| Trường | Giá trị lấy từ đơn thật |
|---|---|
| Sản phẩm | Cửa Đi 1 Cánh · Cửa Sổ · Cửa Đi 4 Cánh · Cửa Đi 2 Cánh · Cửa Đi Vách Kính · Cửa Sổ 3 Cánh |
| Model | GM1-H1/H3/H5-1TK · GM1-H3 · GM1-Đ-CK-1TK · CS2/CS3-Đ-H10-(1,2,3)TK · CSLUX2/CSLUX4-Đ-H10 · GM2-Đ-H3/H5-(2TK,2NC) · GM2-Đ-HPK-VK · GM4-L-H3-HPK-(3TK,3NC) · LX4-L-H3-HPK-3TK · GMLUX4-L-H3-H9-3TK |
| Hướng mở | NP · TP · TT · NT |
| Phào | Thuận · Vuông · Nghịch |
| Màu sơn | GM-01…GM-14 (dùng nhiều: 01, 06, 09, 14, 11) |
| Kích thước | Cao 1.000–3.200 mm · Rộng 850–3.200 mm · Khuôn 120–250 mm (bội 5 mm) |
| Hàng kèm | KHÓA (GM805, GM202, GM330, GM505, GM700) · Ô Thoáng (kính 90k/m², nan chớp 350k/m²) · Phao Rời (PR, 70k/m) |
| Đơn giá | 1.850.000–3.250.000 đ/m² (bội 10.000) |
| Mã đơn | `YYMMDD` + số thứ tự trong ngày + Mã ĐL + `DH` + số thứ tự của đại lý |
| Đại lý | 70 đại lý theo tỉnh (BN, BG, HD, LĐ, ĐL, HN, HY, VP, TN, NB, TH, NA, QB, DN, SG…) |

Mã đơn mô phỏng **không trùng** mã đơn thật (kiểm tra bằng `assert` khi sinh).

## 7. Kiểm chứng đã làm

| Kiểm tra | Kết quả |
|---|---|
| Nạp 1.000 đơn qua **đúng API** `POST /api/orders` | ✅ 1.000/1.000, 0 lỗi, 10 giây |
| Bộ cửa / hàng kèm / câu hỏi tạo đúng | ✅ 2.383 · 4.087 · 6.000 |
| Đồng bộ sang module kế hoạch | ✅ 2.246 bộ · 53.904 công đoạn |
| Xếp lịch tự động | ✅ 2.246 bộ, app báo ngày kết thúc 08/12/2027 (quá tải) |
| Trạng thái/% do mình tính **khớp với chính app tính lại** | ✅ **36/36** bộ (trừ nhóm chờ xếp lịch — xem mục 5.1) |
| Nạp `sim-1000-don.sql` vào **DB trống** | ✅ 8 giây, **8/8 bảng khớp số dòng** |
| Chữ ký dữ liệu (tổng tiền, trạng thái, tổng %, số làm lại, danh sách bộ số) nguồn = bản nạp | ✅ **khớp hoàn toàn** |
| Liên kết sau khi nạp | ✅ 2.246/2.246 bộ có `order_item_id` · 53.904/53.904 công đoạn · 6.738 lệnh con khớp bộ |
| `sim-1000-don-CLEANUP.sql` | ✅ xoá sạch về 0 đơn / 0 bộ / 0 công đoạn, không đụng dữ liệu khác |
| Báo cáo sản xuất đọc được | ✅ OTD 70% · giao trễ 85 · quá hạn chưa giao 5 · làm lại 3,0% · 8,3 giờ/công đoạn |

## 8. File kèm theo

| File | Nội dung |
|---|---|
| `sim-1000-don.sql` (21,9 MB) | Dữ liệu đầy đủ, **không kèm id** → nạp được vào DB đang có đơn thật |
| `sim-1000-don-CLEANUP.sql` | Gỡ đúng 1.000 đơn mô phỏng |
| `scripts/simulation/gen.py` | Sinh đơn (sản phẩm/kích thước/màu/giá/hàng kèm ngẫu nhiên có kiểm soát) |
| `scripts/simulation/post.py` | Nạp đơn qua API thật |
| `scripts/simulation/simulate.py` | Mô phỏng tiến độ theo công đoạn |
| `scripts/simulation/export_sql.py` | Xuất .sql cầm theo được |
| `scripts/simulation/load.sql` | Nạp CSV mô phỏng vào DB (COPY + 1 lượt UPDATE) |
