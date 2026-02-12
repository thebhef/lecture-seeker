import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateIcs } from "@/lib/ics-generator";
import { sendInviteEmail } from "@/lib/email";
import { sendInviteSchema } from "@lecture-seeker/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json();
  const parsed = sendInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    const icsContent = generateIcs(event);
    await sendInviteEmail({
      to: parsed.data.email,
      eventTitle: event.title,
      icsContent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
