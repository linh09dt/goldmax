import Link from "next/link";
import {
  ORDER_LIST_PRESETS,
  buildOrderListQueryString,
  clean,
  normalizeOrderListStatus,
  resolveDatePreset,
  type OrderListQuery,
} from "@/lib/order-list-filters";

/**
 * V101: thanh lọc của màn Quản lý đơn hàng — xếp theo LƯỚI 12 CỘT để các ô thẳng hàng, cân đối
 * (trước đây mỗi ô một chiều rộng rời rạc nên hàng bị lệch và chữ bị cắt).
 * Component thuần trình bày (server component), không tự truy vấn dữ liệu.
 *
 * Hàng 1: Tìm nhanh (3) · Khoảng ngày (5) · Từ ngày (2) · Đến ngày (2)
 * Hàng 2: Đại lý (3) · Khách hàng (3) · nút thao tác (6, dồn phải)
 * Tỉ lệ này chọn theo SỐ ĐO THẬT ở màn 1280px: dải 5 chip cần 329px nên phải được 5 cột (383px).
 * Màn hẹp: tự xếp 2 cột rồi 1 cột.
 */

const CELL = "min-w-0";
const LABEL = "text-[10px] font-bold uppercase tracking-wide text-slate-500";
const CHIP =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-[11.5px] font-semibold transition";

export function OrderFilterBar({
  query,
  dealers,
  customers,
  exportHref,
}: {
  query: OrderListQuery;
  dealers: { value: string; label: string }[];
  customers: string[];
  exportHref: string;
}) {
  const statusFilter = normalizeOrderListStatus(query.status);

  return (
    <form method="GET" className="erp-card mt-5 px-3 py-3">
      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-12">
        <input type="hidden" name="status" value={statusFilter === "all" ? "" : statusFilter} />

        <label className={`${CELL} sm:col-span-2 xl:col-span-3`}>
          <span className={LABEL}>Tìm nhanh</span>
          <input
            className="erp-input mt-1 h-9"
            type="search"
            name="q"
            defaultValue={clean(query.q)}
            placeholder="Mã đơn, khách hàng, SĐT…"
          />
        </label>

        <div className={`${CELL} sm:col-span-2 xl:col-span-5`}>
          <span className={LABEL}>Khoảng ngày</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {ORDER_LIST_PRESETS.map((preset) => {
              const bounds = resolveDatePreset(preset.value);
              const active = Boolean(bounds) && clean(query.from) === bounds?.from && clean(query.to) === bounds?.to;
              return (
                <Link
                  key={preset.value}
                  className={`${CHIP} ${
                    active
                      ? "border-cyan-700 bg-cyan-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  href={`/orders${buildOrderListQueryString(query, {
                    from: bounds?.from ?? "",
                    to: bounds?.to ?? "",
                    page: "",
                    orderId: "",
                  })}`}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>
        </div>

        <label className={`${CELL} xl:col-span-2`}>
          <span className={LABEL}>Từ ngày</span>
          <input className="erp-input mt-1 h-9" type="date" name="from" defaultValue={clean(query.from)} />
        </label>

        <label className={`${CELL} xl:col-span-2`}>
          <span className={LABEL}>Đến ngày</span>
          <input className="erp-input mt-1 h-9" type="date" name="to" defaultValue={clean(query.to)} />
        </label>

        <label className={`${CELL} xl:col-span-3`}>
          <span className={LABEL}>Đại lý</span>
          <select className="erp-input mt-1 h-9" name="dealer" defaultValue={clean(query.dealer)}>
            <option value="">Tất cả đại lý</option>
            {dealers.map((dealer) => (
              <option key={dealer.value} value={dealer.value}>
                {dealer.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`${CELL} xl:col-span-3`}>
          <span className={LABEL}>Khách hàng</span>
          <select className="erp-input mt-1 h-9" name="customer" defaultValue={clean(query.customer)}>
            <option value="">Tất cả khách hàng</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </label>

        <div className={`${CELL} flex flex-wrap items-center gap-2 self-end sm:col-span-2 xl:col-span-6 xl:justify-end`}>
          <button type="submit" className="erp-button h-9 px-3.5 text-[12px]">
            Lọc
          </button>
          <Link className="erp-button-secondary flex h-9 items-center px-3.5 text-[12px]" href="/orders">
            Xoá lọc
          </Link>
          <a
            className="inline-flex h-9 items-center rounded-lg border border-emerald-700 bg-emerald-600 px-3.5 text-[12px] font-semibold text-white transition hover:bg-emerald-500"
            href={exportHref}
          >
            ⤓ Xuất Excel danh sách
          </a>
        </div>
      </div>
    </form>
  );
}
