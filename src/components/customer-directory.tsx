"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { orderStatusLabel } from "@/lib/order-form";

type CustomerOrder = {
  id: number;
  orderCode: string;
  status: string;
  orderDate: string | null;
  amount: number;
};

type Customer = {
  key: string;
  name: string;
  phone: string | null;
  address: string | null;
  customerCode: string | null;
  salesEmployeeCode: string | null;
  region: string | null;
  orderCount: number;
  totalAmount: number;
  lastOrderDate: string | null;
  firstOrderDate: string | null;
  orders: CustomerOrder[];
};

type ApiResponse = {
  ok: boolean;
  customers?: Customer[];
  matched?: number;
  totalCustomers?: number;
  scannedOrders?: number;
  totalOrders?: number;
  error?: string;
};

type SortKey = "recent" | "orders" | "amount";

/** V79: tab Thông tin khách hàng — tự động tổng hợp từ các đơn hàng đã lưu. */
export function CustomerDirectory() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<SortKey>("recent");

  const load = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set("q", keyword.trim());
      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.ok) throw new Error(result.error || "Không thể tải danh sách khách hàng.");
      setData(result);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách khách hàng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const customers = useMemo(() => {
    const list = [...(data?.customers ?? [])];
    if (sort === "orders") list.sort((a, b) => b.orderCount - a.orderCount || b.totalAmount - a.totalAmount);
    else if (sort === "amount") list.sort((a, b) => b.totalAmount - a.totalAmount || b.orderCount - a.orderCount);
    return list;
  }, [data, sort]);

  const totals = useMemo(() => ({
    orders: customers.reduce((sum, item) => sum + item.orderCount, 0),
    amount: customers.reduce((sum, item) => sum + item.totalAmount, 0),
    withPhone: customers.filter((item) => item.phone).length,
    withAddress: customers.filter((item) => item.address).length,
  }), [customers]);

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <section className="erp-card">
        <div className="flex flex-col gap-2.5 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-semibold text-slate-900">Danh bạ khách hàng</h2>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">{customers.length} khách hàng</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{totals.orders} đơn</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">Tổng {formatMoney(totals.amount)}đ</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="erp-input w-80 max-w-full"
              placeholder="Tìm theo tên, số điện thoại, địa chỉ, mã đại lý hoặc mã đơn..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select className="erp-input w-44" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="recent">Đơn gần nhất</option>
              <option value="orders">Nhiều đơn nhất</option>
              <option value="amount">Doanh thu cao nhất</option>
            </select>
            <a className="erp-button-secondary" href={`/api/customers/export${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`}>Xuất Excel</a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 text-[11px] text-slate-500">
          <span>Dữ liệu lấy tự động từ {data?.scannedOrders ?? 0}/{data?.totalOrders ?? 0} đơn hàng gần nhất — không cần nhập tay danh bạ.</span>
          <span>Có số điện thoại: <b className="text-slate-700">{totals.withPhone}</b></span>
          <span>Có địa chỉ: <b className="text-slate-700">{totals.withAddress}</b></span>
        </div>

        {error ? <div className="border-t border-red-200 bg-red-50 px-3.5 py-2 text-[12px] text-red-700">{error}</div> : null}
      </section>

      <section className="erp-card overflow-hidden">
        <div className="erp-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-100">
                <th className="w-12 px-2 py-2.5 text-center">STT</th>
                <th className="px-3 py-2.5">Tên khách hàng</th>
                <th className="w-36 px-3 py-2.5">Số điện thoại</th>
                <th className="px-3 py-2.5">Địa chỉ</th>
                <th className="w-28 px-3 py-2.5">Mã Đại Lý</th>
                <th className="w-20 px-3 py-2.5 text-center">Số đơn</th>
                <th className="w-32 px-3 py-2.5 text-right">Tổng tiền</th>
                <th className="w-32 px-3 py-2.5">Đơn gần nhất</th>
                <th className="w-24 px-3 py-2.5 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Chưa có khách hàng nào khớp điều kiện tìm kiếm.</td></tr>
              ) : customers.map((customer, index) => {
                const open = expanded.has(customer.key);
                return (
                  <Fragment key={customer.key}>
                    <tr className="border-b border-slate-100 hover:bg-cyan-50/40">
                      <td className="px-2 py-2.5 text-center tabular-nums text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{customer.name}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">{customer.phone || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600">{customer.address || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600">{customer.customerCode || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">{customer.orderCount}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-sky-900">{formatMoney(customer.totalAmount)}đ</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {customer.lastOrderDate ? formatDate(customer.lastOrderDate) : "—"}
                        {customer.orders[0] ? <span className="ml-1 text-[11px] text-slate-400">{customer.orders[0].orderCode}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => toggle(customer.key)}
                        >
                          {open ? "Thu gọn" : `Xem ${customer.orderCount} đơn`}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-50">
                        <td colSpan={9} className="px-4 py-2.5">
                          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Đơn hàng của {customer.name}
                          </div>
                          <div className="erp-scrollbar overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse text-[12px]">
                              <thead>
                                <tr className="bg-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-600">
                                  <th className="px-2 py-1.5">Mã đơn</th>
                                  <th className="w-28 px-2 py-1.5">Ngày đặt</th>
                                  <th className="w-40 px-2 py-1.5">Trạng thái</th>
                                  <th className="w-28 px-2 py-1.5 text-right">Tổng tiền</th>
                                </tr>
                              </thead>
                              <tbody>
                                {customer.orders.map((order) => (
                                  <tr key={order.id} className="border-b border-slate-100">
                                    <td className="px-2 py-1.5">
                                      <Link className="font-semibold text-cyan-700 hover:underline" href={`/orders/${order.id}`}>{order.orderCode}</Link>
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums text-slate-600">{order.orderDate ? formatDate(order.orderDate) : "—"}</td>
                                    <td className="px-2 py-1.5 text-slate-600">{orderStatusLabel(order.status)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{formatMoney(order.amount)}đ</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
