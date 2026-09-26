# SIM-500 — BÁO CÁO CÔNG ĐOẠN (WIP · ĐANG DỞ · BACKLOG)

Sinh tự động từ 10 file `sim-500/don-*.sql` (500 đơn). Danh mục công đoạn V139 (12 công đoạn tách phần).
Mốc tham chiếu "hôm nay": **26/09/2026**.

## 1. Bộ cửa theo trạng thái — thấy BACKLOG / WIP / ĐANG DỞ

| Trạng thái bộ | Số bộ | Tỷ lệ | Ý nghĩa khi xem |
|---|---:|---:|---|
| Đang sản xuất (WIP) | 302 | 30.0% | **WIP / ĐANG DỞ** — đang ở các công đoạn khác nhau |
| Chờ xếp lịch (BACKLOG) | 221 | 22.0% | **BACKLOG** — có lệnh, chưa xếp lịch |
| Đã xếp lịch | 181 | 18.0% | Đã có ngày kế hoạch, chưa làm |
| Đã giao | 141 | 14.0% |  |
| Hoàn thành (chưa giao) | 91 | 9.0% |  |
| Tạm dừng | 50 | 5.0% |  |
| Đã huỷ | 20 | 2.0% |  |
| **Tổng** | **1.006** | 100% | |

## 2. Công đoạn theo trạng thái — WIP nằm ở công đoạn nào

| Bước | Công đoạn | Tổ | Tổng việc | Chưa làm | Đang làm | Xong | Tạm dừng | Làm lại | Giờ TB/thực tế |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| 10 | Thiết kế (bản vẽ CAD) | KY_THUAT | 1.006 | 422 | 0 | 584 | 0 | 21 | 8.48 |
| 20 | Bồi Lares — nạp chương trình máy cắt (CAM) | KY_THUAT | 1.006 | 422 | 22 | 559 | 3 | 17 | 8.46 |
| 25 | Chờ sau Bồi Lares mới cắt được | — | 1.006 | 447 | 20 | 535 | 4 | 14 | 8.48 |
| 30 | Cắt cánh | TO_MAY | 1.006 | 471 | 23 | 508 | 4 | 11 | 8.48 |
| 30 | Cắt khung | TO_MAY | 1.006 | 471 | 23 | 508 | 4 | 17 | 8.49 |
| 30 | Cắt phào | TO_MAY | 1.006 | 471 | 23 | 508 | 4 | 19 | 8.45 |
| 40 | Chấn cánh | TO_MAY | 1.006 | 498 | 12 | 495 | 1 | 17 | 8.43 |
| 40 | Chấn khung | TO_MAY | 1.006 | 498 | 12 | 495 | 1 | 14 | 8.42 |
| 40 | Chấn phào | TO_MAY | 1.006 | 498 | 12 | 495 | 1 | 16 | 8.49 |
| 50 | Hàn cánh | TO_HAN | 1.006 | 511 | 18 | 473 | 4 | 13 | 8.39 |
| 50 | Hàn khung | TO_HAN | 1.006 | 511 | 18 | 473 | 4 | 10 | 8.44 |
| 50 | Hàn phào | TO_HAN | 1.006 | 511 | 18 | 473 | 4 | 10 | 8.53 |
| 60 | Ép cánh (sau khi hàn cánh) | TO_HAN | 1.006 | 533 | 17 | 451 | 5 | 13 | 8.39 |
| 70 | Test cơ khí (QC — lắp ghép kiểm tra trước sơn) | TO_HAN | 1.006 | 555 | 19 | 427 | 5 | 8 | 8.41 |
| 75 | Chờ sơn (sau test cơ khí) | — | 1.006 | 579 | 22 | 403 | 2 | 11 | 8.34 |
| 80 | Sơn (cả bộ 1 lượt — GATE: đủ 3 phần đã test) | TO_SON | 1.006 | 603 | 26 | 376 | 1 | 14 | 8.50 |
| 85 | Chờ khô / nguội sau sơn | — | 1.006 | 630 | 12 | 358 | 6 | 11 | 8.41 |
| 90 | Vân cánh | TO_VAN | 1.006 | 648 | 23 | 333 | 2 | 10 | 8.42 |
| 90 | Vân khung | TO_VAN | 1.006 | 648 | 23 | 333 | 2 | 11 | 8.48 |
| 90 | Vân phào | TO_VAN | 1.006 | 648 | 23 | 333 | 2 | 9 | 8.37 |
| 95 | Chờ sau vân trước khi lắp kính / đóng gói | — | 1.006 | 673 | 21 | 307 | 5 | 12 | 8.40 |
| 100 | Lắp kính + phụ kiện | TO_DONG_GOI | 1.006 | 699 | 17 | 286 | 4 | 7 | 8.56 |
| 110 | Vệ sinh + đóng gói (mốc HOÀN THÀNH SẢN XUẤT) | TO_DONG_GOI | 1.006 | 720 | 27 | 258 | 1 | 7 | 8.48 |
| 120 | Kho / giao hàng (đã giao khách) | KHO | 1.006 | 748 | 23 | 232 | 3 | 5 | 8.52 |

## 3. Trạng thái công đoạn (toàn bộ)

| Trạng thái | Số công đoạn |
|---|---:|
| Chưa làm | 13.415 |
| Xong | 10.203 |
| Đang làm | 454 |
| Tạm dừng | 72 |

## 4. Đang dở nằm ở công đoạn nào (DANG_LAM + TAM_DUNG)

| Công đoạn | Số việc đang dở |
|---|---:|
| Bồi Lares — nạp chương trình máy cắt (CAM) | 25 |
| Chấn cánh | 13 |
| Chấn khung | 13 |
| Chấn phào | 13 |
| Chờ khô / nguội sau sơn | 18 |
| Chờ sau Bồi Lares mới cắt được | 24 |
| Chờ sau vân trước khi lắp kính / đóng gói | 26 |
| Chờ sơn (sau test cơ khí) | 24 |
| Cắt cánh | 27 |
| Cắt khung | 27 |
| Cắt phào | 27 |
| Hàn cánh | 22 |
| Hàn khung | 22 |
| Hàn phào | 22 |
| Kho / giao hàng (đã giao khách) | 26 |
| Lắp kính + phụ kiện | 21 |
| Sơn (cả bộ 1 lượt — GATE: đủ 3 phần đã test) | 27 |
| Test cơ khí (QC — lắp ghép kiểm tra trước sơn) | 24 |
| Vân cánh | 25 |
| Vân khung | 25 |
| Vân phào | 25 |
| Vệ sinh + đóng gói (mốc HOÀN THÀNH SẢN XUẤT) | 28 |
| Ép cánh (sau khi hàn cánh) | 22 |

## 5. Mốc thời gian

- Ngày kế hoạch: **2026-08-01 → 2026-11-04**
- Bộ có **kế hoạch xong MUỘN hơn hạn giao**: **419 / 1.006** (41.7%) → xưởng đang **quá tải**, app sẽ báo cảnh báo đỏ.
- **OTD (giao đúng hạn)**: 99/141 = **70.2%** (khớp thực trạng nhà máy trễ nhiều).

> Xem trên app: **Kế hoạch sản xuất** (bảng tải theo tổ + dòng con theo công đoạn, cảnh báo quá tải),
> **Báo cáo → Sản xuất (OTD)** (OTD · năng suất tổ · thời gian từng công đoạn · làm lại · lý do trễ · tồn kho).
