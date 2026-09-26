# SIM-500 — BÁO CÁO BỘ DỮ LIỆU ĐỂ LẬP KẾ HOẠCH (BACKLOG SẠCH)

Sinh tự động từ 10 file `sim-500/don-*.sql` (500 đơn). Danh mục công đoạn V139 (tách phần).
**Điểm xuất phát: 1.056/1.056 bộ ở trạng thái CHỜ XẾP LỊCH — chưa gán ngày, chưa sản xuất**
(bộ có ngày kế hoạch: 0 · công đoạn không phải "Chưa làm": 0).

## 1. Tổng quan

| Hạng mục | Số lượng |
|---|---:|
| Đơn hàng | **500** (10 file × 50 đơn) |
| Dòng bộ cửa (= số bộ trong kế hoạch) | **1.056** |
| Bộ theo số lượng (cộng `quantity`) | 2.280 |
| **Tổng cánh quy đổi** (dùng tính tải) | **4.527** |
| Lệnh con Cánh/Khung/Phào | 3.168 (3/bộ) |
| Công đoạn phải làm | **25.344** (24/bộ) |
| Ngày đặt | 2026-10-01 → 2026-11-10 |
| Ngày giao khách | 2026-10-17 → 2026-11-30 |

Loại đơn: SAN_XUAT 329 · MAU 126 · LAM_LAI 45.
Đơn vào kế hoạch theo tháng: 10/2026: 355 đơn · 11/2026: 145 đơn.

## 2. Hạn giao theo THÁNG — biết tháng nào phải làm

| Tháng giao | Số bộ | Cánh quy đổi |
|---|---:|---:|
| 10/2026 | 87 | 398 |
| 11/2026 | 969 | 4.129 |

## 3. Hạn giao theo TUẦN (tuần bắt đầu từ Thứ 2) — tuần nào CĂNG nhất

| Tuần (từ ngày) | Số bộ | Cánh quy đổi | Bộ có >1 bộ/lượt |
|---|---:|---:|---:|
| 02/11 | 144 | 650 | 72 |
| 09/11 | 189 | 914 | 101 |
| 12/10 | 9 | 61 | 6 |
| 16/11 | 246 | 919 | 113 |
| 19/10 | 18 | 87 | 8 |
| 23/11 | 333 | 1.391 | 163 |
| 26/10 | 70 | 296 | 35 |
| 30/11 | 47 | 209 | 26 |

> Cột **cánh quy đổi** so với năng lực ngày của xưởng (Cấu hình sản xuất → ngưỡng vàng/đỏ, mặc định 70/80 cánh/ngày)
> để thấy tuần nào cần dàn đều. Bảng *Tải theo tổ và ngày* trong app sẽ hiện ô vàng/đỏ khi bạn gán ngày.

## 4. 10 NGÀY GIAO nhiều bộ nhất — ngày nào dễ vỡ kế hoạch

| Ngày giao | Số bộ | Cánh quy đổi |
|---|---:|---:|
| 2026-11-27 | 88 | 384 |
| 2026-11-23 | 51 | 227 |
| 2026-11-30 | 47 | 209 |
| 2026-11-16 | 44 | 165 |
| 2026-11-29 | 44 | 192 |
| 2026-11-26 | 43 | 160 |
| 2026-11-24 | 41 | 188 |
| 2026-11-19 | 40 | 171 |
| 2026-11-12 | 38 | 181 |
| 2026-11-22 | 38 | 99 |

## 5. Chủng loại (theo model) — 12 model nhiều nhất

| Model | Số bộ | Cánh quy đổi |
|---|---:|---:|
| GM1-Đ-CK-1TK | 97 | 228 |
| GM2-Đ-HPK-VK-2TK | 80 | 346 |
| GM2-Đ-HPK-VK-3TK | 47 | 174 |
| CS2-L-H10-1TK | 38 | 164 |
| GM1-H1-1NC | 35 | 93 |
| CS2-L-H10-2TK | 32 | 164 |
| CS2-Đ-H10-1TK | 32 | 120 |
| GM1-H1-1TK | 32 | 75 |
| GM4-L-H3-HPK-3NC | 31 | 232 |
| CS2-Đ-H10-2TK | 30 | 146 |
| GM1-H3-1TK | 30 | 62 |
| GM2-Đ-HPK-VK-2NC | 30 | 130 |

## 6. Khối lượng công đoạn theo TỔ — làm hết thì mỗi tổ bao nhiêu việc

| Tổ | Số việc (công đoạn) | Số bộ liên quan |
|---|---:|---:|
| TO_MAY | 6.336 | 1.056 |
| TO_HAN | 5.280 | 1.056 |
| (chưa gán) | 4.224 | 1.056 |
| TO_VAN | 3.168 | 1.056 |
| TO_DONG_GOI | 2.112 | 1.056 |
| KY_THUAT | 2.112 | 1.056 |
| KHO | 1.056 | 1.056 |
| TO_SON | 1.056 | 1.056 |

## 7. Cách dùng bộ dữ liệu này

1. Nạp 10 file `sim-500/don-*.sql` (đúng thứ tự) — hoặc chạy `migrate-production-v142-lenh-cong-doan.sql`
   sau khi nạp để sinh **lệnh sản xuất** cho từng công đoạn (V142).
2. Vào **Kế hoạch sản xuất** → danh sách *Bộ chờ xếp lịch* (đủ 1.056 bộ).
3. Mở từng bộ → gán **Ngày KH** cho các công đoạn (xếp tay — V141), ưu tiên theo cột **Ngày giao** ở mục 3–4.
4. Xem **Tải theo tổ và ngày** để biết ngày nào quá tải, và **In phiếu lệnh SX / Danh sách việc theo ngày** để phát xưởng.

> Ghi chú: bộ dữ liệu này **cố ý KHÔNG có** bộ đang sản xuất / đã giao / làm lại — để bạn tập làm kế hoạch từ đầu.
> Muốn bộ dữ liệu có WIP–đã giao–trễ như bản trước thì đặt lại `SCEN_TARGET` trong `scripts/simulation/gen_sim500.py`.
