import { prisma } from "@/lib/prisma";

/**
 * V79: Thông tin khách hàng được TỰ ĐỘNG thu thập từ các đơn hàng đã lưu.
 * Người dùng không phải nhập tay danh bạ: mỗi khi lưu đơn, khách hàng xuất hiện
 * trong tab này với tên khách hàng, số điện thoại và địa chỉ nhận hàng.
 */

export type CustomerOrderSummary = {
  id: number;
  orderCode: string;
  /** V112: loại đơn (MAU | SAN_XUAT | LAM_LAI). */
  orderType: string | null;
  status: string;
  orderDate: string | null;
  amount: number;
};

export type CustomerRecord = {
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
  orders: CustomerOrderSummary[];
};

export type CustomerDirectory = {
  customers: CustomerRecord[];
  scannedOrders: number;
  totalOrders: number;
};

/** Giới hạn an toàn để trang khách hàng luôn tải nhanh. */
const MAX_SCANNED_ORDERS = 5000;
const MAX_ORDERS_PER_CUSTOMER = 200;

export async function loadCustomerDirectory(): Promise<CustomerDirectory> {
  const [orders, totalOrders] = await Promise.all([
    prisma.salesOrder.findMany({
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      take: MAX_SCANNED_ORDERS,
      select: {
        id: true,
        orderCode: true,
        orderType: true,
        status: true,
        orderDate: true,
        customerCode: true,
        customerName: true,
        salesEmployeeCode: true,
        receiverPhone: true,
        receiverAddress: true,
        region: true,
        subtotal: true,
      },
    }),
    prisma.salesOrder.count(),
  ]);

  const map = new Map<string, CustomerRecord>();

  for (const order of orders) {
    const name = cleanText(order.customerName);
    const key = customerKey(name);
    const amount = toNumber(order.subtotal);
    const summary: CustomerOrderSummary = {
      id: order.id,
      orderCode: order.orderCode,
      orderType: order.orderType,
      status: order.status,
      orderDate: toDateString(order.orderDate),
      amount,
    };

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: name || "(Chưa có tên khách hàng)",
        phone: cleanText(order.receiverPhone),
        address: cleanText(order.receiverAddress),
        customerCode: cleanText(order.customerCode),
        salesEmployeeCode: cleanText(order.salesEmployeeCode),
        region: cleanText(order.region),
        orderCount: 1,
        totalAmount: amount,
        lastOrderDate: summary.orderDate,
        firstOrderDate: summary.orderDate,
        orders: [summary],
      });
      continue;
    }

    existing.orderCount += 1;
    existing.totalAmount += amount;
    // Đơn được duyệt theo thứ tự mới nhất trước → giá trị đầu tiên là giá trị mới nhất.
    if (!existing.phone) existing.phone = cleanText(order.receiverPhone);
    if (!existing.address) existing.address = cleanText(order.receiverAddress);
    if (!existing.customerCode) existing.customerCode = cleanText(order.customerCode);
    if (!existing.salesEmployeeCode) existing.salesEmployeeCode = cleanText(order.salesEmployeeCode);
    if (!existing.region) existing.region = cleanText(order.region);
    if (existing.orders.length < MAX_ORDERS_PER_CUSTOMER) existing.orders.push(summary);
    if (summary.orderDate && (!existing.firstOrderDate || summary.orderDate < existing.firstOrderDate)) {
      existing.firstOrderDate = summary.orderDate;
    }
  }

  const customers = Array.from(map.values()).sort((a, b) => {
    const left = a.lastOrderDate ?? "";
    const right = b.lastOrderDate ?? "";
    if (left !== right) return right.localeCompare(left);
    return a.name.localeCompare(b.name, "vi");
  });

  return { customers, scannedOrders: orders.length, totalOrders };
}

/** Tìm không phân biệt dấu: "thanh phat" khớp "Thành Phát". */
export function filterCustomers(customers: CustomerRecord[], query: string) {
  const needle = searchKey(query);
  if (!needle) return customers;
  return customers.filter((customer) => {
    const haystack = searchKey([
      customer.name,
      customer.phone,
      customer.address,
      customer.customerCode,
      customer.salesEmployeeCode,
      customer.region,
    ].filter(Boolean).join(" "));
    if (haystack.includes(needle)) return true;
    return customer.orders.some((order) => searchKey(order.orderCode).includes(needle));
  });
}

function cleanText(value: string | null | undefined) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || null;
}

function customerKey(name: string | null) {
  return searchKey(name) || "(chua-co-ten)";
}

function searchKey(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value: Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
