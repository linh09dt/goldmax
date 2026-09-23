# V41.22 - Export header fields

Chỉ thay phần thông tin đầu trang của tất cả chức năng xuất đơn hàng.

## 6 trường chuẩn

Hàng 1:
- Tên khách hàng
- Địa chỉ
- Ngày đặt hàng

Hàng 2:
- Mã đại lý
- Mã nhân viên
- Ngày trả dự kiến

## Áp dụng
- Excel cũ: `src/lib/order-export.ts`
- PDF/Print cũ: `src/app/orders/[id]/print/page.tsx`
- CSS PDF/Print cũ: `src/app/globals.css`
- Excel V2: `src/lib/order-export-v2.ts`
- PDF V2 ReportLab: `python/reportlab_order_v2.py`

Không đổi dữ liệu đơn hàng, logic tính giá, hình ảnh, bảng chi tiết hay các chức năng khác.
