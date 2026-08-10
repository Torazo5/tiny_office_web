import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordProductEvent } from "@/lib/product-events";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(requestUrl.searchParams.get("next"));
  const supabase = await createClient();

  let error: { message: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    error = { message: "Missing authentication callback parameters." };
  }

  if (error) {
    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", error.message);
    errorUrl.searchParams.set("next", next);
    return NextResponse.redirect(errorUrl);
  }

  try {
    await recordProductEvent({ eventName: "sign_in_completed", route: next, source: "auth_callback" });
  } catch {
    // Authentication must succeed even when telemetry is unavailable.
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
