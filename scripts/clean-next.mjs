import { rmSync } from "node:fs";

// Xóa build/dev cache cũ trước production build.
// Next.js 16 có thể để lại .next/dev/types từ `next dev`; nếu cache này còn tồn tại,
// TypeScript trong `next build` có thể đọc type route cũ và báo sai "Cannot find module".
rmSync(".next", { recursive: true, force: true });
