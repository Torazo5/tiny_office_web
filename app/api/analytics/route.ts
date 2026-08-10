import { NextResponse } from "next/server";
import { recordProductEvent, sanitizeProductEvent } from "@/lib/product-events";

export async function POST(request: Request) {
  try {
    const event = sanitizeProductEvent(await request.json());
    if (!event) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    await recordProductEvent(event);
  } catch {
    // Analytics must never break the listening experience or reveal internals.
  }
  return new NextResponse(null, { status: 204 });
}
