import { ErpShell } from "@/components/erp-shell";
import { ProductImageTool } from "@/components/product-image-tool";

/**
 * V110 — Trang công cụ chuẩn hóa ảnh sản phẩm trước khi upload vào ô "Hình ảnh SP".
 * Không truy vấn database, toàn bộ xử lý ảnh chạy ở trình duyệt.
 */
export default function ProductImageToolPage() {
  return (
    <ErpShell
      title="Chuẩn hóa ảnh sản phẩm"
      subtitle="Dán ảnh vào đây để nhận ảnh đúng khung (5:3 · 400 × 240 px) — upload xong xuất Excel/PDF không bị méo, không phá form."
    >
      <ProductImageTool />
    </ErpShell>
  );
}
