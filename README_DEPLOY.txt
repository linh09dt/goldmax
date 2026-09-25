GOLDMAX ERP — GÓI DEPLOY (V129)
===============================

GỒM 2 VIỆC ĐANG CHỜ:
  1. Trang Khảo sát nhà máy (/khao-sat) + bảng survey_answers   → CÓ migration, phải chạy SQL TRƯỚC
  2. UI thông tin đơn gọn 1 hàng (V112b/c) + tab Tổng quan (V113) → chỉ code, KHÔNG cần SQL

LÀM ĐÚNG 2 BƯỚC:
  B1. npx prisma migrate deploy            (hoặc dán migrate-survey-v126.sql vào Supabase SQL Editor,
                                            rồi chạy: npx prisma migrate resolve --applied 20260925160000_survey_v126)
  B2. deploy code lên Vercel như bình thường

KIỂM TRA SAU DEPLOY (3 phút):
  - /khao-sat mở được, có 230 câu, gõ thử 1 câu → hiện "Đã lưu lúc hh:mm"
  - Supabase: bảng survey_answers có dòng vừa gõ
  - /orders: có dải lọc Tất cả / Đơn hàng mẫu / Sản xuất / Đơn làm lại
  - Mở 1 đơn: hàng "Thông tin đơn hàng" nằm gọn 1 hàng
  - Trang / (Tổng quan): 6 thẻ KPI + biểu đồ + Top đại lý/NVKD/sản phẩm
  - /revenue: chỉ gồm đơn Sản xuất + Đã xác nhận

KHÔNG CẦN: biến môi trường mới, đổi cấu hình Vercel.

NẾU LỖI:
  - /khao-sat 500 + log P2021  → chưa chạy B1
  - migrate báo P3009/drift    → npx prisma migrate resolve --applied 20260925120000_order_type_v112
  - Tổng quan trống số         → bấm "Tất cả" ở dải kỳ
  - Quay lại bản trước         → Vercel → Deployments → bản trước → Promote to Production

CHI TIẾT ĐẦY ĐỦ: HUONG_DAN_DEPLOY_V129.md (trong gói này)
Đã diễn tập trên môi trường giống production: migrate OK, 7 trang đều 200, không lỗi log.
