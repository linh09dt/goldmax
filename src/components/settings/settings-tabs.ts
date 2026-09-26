/**
 * V76: gộp 3 tab Danh mục hàng hóa / Danh mục cấu hình / Cấu hình tính toán
 * thành một tab CẤU HÌNH, chia theo đúng thứ tự nghiệp vụ ERP:
 * nhập dữ liệu nền trước, rồi mới gán quy tắc tính toán.
 *
 * File dữ liệu thuần (không "use client") để server và client dùng chung.
 */

export type SettingsTabKey = "items" | "options" | "categories" | "pricing";

type SettingsTab = {
  key: SettingsTabKey;
  code: string;
  title: string;
  description: string;
};

type SettingsTabGroup = {
  label: string;
  hint: string;
  tabs: SettingsTab[];
};

export const SETTINGS_TAB_GROUPS: SettingsTabGroup[] = [
  {
    label: "Dữ liệu nền",
    hint: "Khai báo một lần, dùng lại cho mọi đơn hàng",
    tabs: [
      {
        key: "items",
        code: "A1",
        title: "Danh mục hàng hóa",
        description: "TENHANG, MODEL, tên diễn giải, ĐVT, giá đại lý và giá bán lẻ.",
      },
      {
        key: "options",
        code: "A2",
        title: "Danh mục cấu hình",
        description: "Các giá trị chọn nhanh trong đơn: màu sơn, hướng mở, hướng phào, ô thoáng, mã đại lý.",
      },
      {
        key: "categories",
        code: "A3",
        title: "Phân loại hàng hóa",
        description: "Tự thêm / đổi tên / xoá phân loại (Cấp cửa, Phụ kiện, Chi phí gia công...) và cách dùng trong đơn.",
      },
    ],
  },
  {
    label: "Quy tắc tính toán",
    hint: "Áp cho các đơn hàng tạo/sửa sau khi lưu",
    tabs: [
      {
        key: "pricing",
        code: "B1",
        title: "Cấu hình tính toán",
        description: "Cách tính KH/Lượng, phụ thu khuôn, đơn giá cửa và số bắt đầu Bộ số.",
      },
    ],
  },
];

const TAB_KEYS = SETTINGS_TAB_GROUPS.flatMap((group) => group.tabs.map((tab) => tab.key));

export function normalizeSettingsTab(value: string | null | undefined): SettingsTabKey {
  const key = String(value ?? "").trim();
  return (TAB_KEYS as string[]).includes(key) ? (key as SettingsTabKey) : "items";
}
