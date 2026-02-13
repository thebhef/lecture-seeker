import { NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:3001";

export async function POST() {
  try {
    const res = await fetch(`${WORKER_URL}/scrape`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Could not reach worker" },
      { status: 502 }
    );
  }
}
