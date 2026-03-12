import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get("source");
    const url = source
      ? `${WORKER_URL}/scrape?source=${encodeURIComponent(source)}`
      : `${WORKER_URL}/scrape`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Could not reach worker" },
      { status: 502 }
    );
  }
}
