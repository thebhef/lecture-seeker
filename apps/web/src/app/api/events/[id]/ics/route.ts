import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateIcs } from "@/lib/ics-generator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const icsContent = generateIcs(event);

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics"`,
    },
  });
}
