import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbHealthRow = {
  database_name: string;
  user_name: string;
  server_version: string;
};

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<DbHealthRow[]>`
      SELECT
        current_database() AS database_name,
        current_user AS user_name,
        current_setting('server_version') AS server_version
    `;

    const info = rows[0];

    return NextResponse.json({
      ok: true,
      database: info?.database_name ?? null,
      user: info?.user_name ?? null,
      postgresql: info?.server_version ?? null,
      app: "ERP Sản xuất cửa",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        app: "ERP Sản xuất cửa",
        error: "Database connection failed",
      },
      { status: 500 },
    );
  }
}
