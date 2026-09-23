V41.18 Diagnostic Trace
- Chỉ sửa api/order_pdf_v2.py
- Không thay layout PDF, Excel, DB, Supabase.
- Thêm diag=trace chạy chính pipeline PDF V2 đến ngay trước binary response.
- Thêm log stage 01..15 trên Vercel.
- Đồng bộ binary response với debug V41.16: Content-Length + flush().

Test sau deploy:
/api/order_pdf_v2?orderId=14&noImages=1&diag=trace
Sau đó thử PDF V2 bình thường và xem stage cuối trong Vercel Function Logs.
