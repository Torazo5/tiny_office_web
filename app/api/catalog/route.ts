import { NextResponse } from "next/server";
import { getBrowsePerformancePage } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? "0");
  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "Invalid catalog page." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getBrowsePerformancePage(offset));
  } catch {
    return NextResponse.json({ error: "Catalog unavailable." }, { status: 503 });
  }
}
