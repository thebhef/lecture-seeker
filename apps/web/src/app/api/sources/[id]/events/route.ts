import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const result = await prisma.event.deleteMany({
    where: { sourceId: id },
  });

  return NextResponse.json({ deleted: result.count });
}
