const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clear existing
  await prisma.transaction.deleteMany();
  await prisma.asset.deleteMany();

  const btc = await prisma.asset.create({
    data: { symbol: 'BTC', name: 'Bitcoin', price: 65000.0 }
  });
  
  const aapl = await prisma.asset.create({
    data: { symbol: 'AAPL', name: 'Apple Inc.', price: 185.50 }
  });

  const tsla = await prisma.asset.create({
    data: { symbol: 'TSLA', name: 'Tesla Inc.', price: 175.00 }
  });

  await prisma.transaction.createMany({
    data: [
      { assetId: btc.id, type: 'BUY', quantity: 0.5, price: 60000.0 },
      { assetId: aapl.id, type: 'BUY', quantity: 100, price: 150.0 },
      { assetId: aapl.id, type: 'BUY', quantity: 50, price: 170.0 },
      { assetId: tsla.id, type: 'BUY', quantity: 200, price: 180.0 },
      { assetId: tsla.id, type: 'SELL', quantity: 50, price: 190.0 },
    ]
  });

  console.log("Database seeded!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
