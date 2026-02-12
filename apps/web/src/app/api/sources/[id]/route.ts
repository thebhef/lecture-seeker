import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;
  if (typeof body.url === "string") updateData.url = body.url;

  const updated = await prisma.source.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (source.isBuiltIn) {
    return NextResponse.json(
      { error: "Cannot delete built-in sources. Disable it instead." },
      { status: 403 }
    );
  }

  await prisma.source.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
