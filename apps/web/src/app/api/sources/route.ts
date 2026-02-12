import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSourceSchema } from "@lecture-seeker/shared";

export async function GET() {
  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { events: true } },
    },
  });

  return NextResponse.json({ data: sources });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSourceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Generate a slug from the name
  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = await prisma.source.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "A source with this name already exists" },
      { status: 409 }
    );
  }

  const source = await prisma.source.create({
    data: {
      name: parsed.data.name,
      slug,
      type: parsed.data.type,
      url: parsed.data.url,
      isBuiltIn: false,
      enabled: true,
    },
  });

  return NextResponse.json({ data: source }, { status: 201 });
}
