import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync(30);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron] sync error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
