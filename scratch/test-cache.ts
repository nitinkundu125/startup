import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const symbol = "TEST";
    const dateKey = "2023-01-01";
    await prisma.scanCache.upsert({
      where: { symbol_dateKey: { symbol, dateKey } },
      update: { results: "[]" },
      create: { symbol, dateKey, results: "[]" }
    });
    console.log("Success");
  } catch(e) {
    console.error(e);
  }
}
main();
