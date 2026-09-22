import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // Prisma CLI / migrate dùng DIRECT_URL.
    // Local: tr? PostgreSQL localhost.
    // Production: tr? Supabase Session Pooler.
    url: env("DIRECT_URL"),
  },
});