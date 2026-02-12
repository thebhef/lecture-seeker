import { PrismaClient } from "@prisma/client";
import { BUILT_IN_SOURCES } from "../constants";

const prisma = new PrismaClient();

async function main() {
  for (const source of BUILT_IN_SOURCES) {
    await prisma.source.upsert({
      where: { slug: source.slug },
      update: { name: source.name, url: source.url, type: source.type },
      create: {
        ...source,
        isBuiltIn: true,
        enabled: true,
      },
    });
  }
  console.log(`Seeded ${BUILT_IN_SOURCES.length} built-in sources`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
