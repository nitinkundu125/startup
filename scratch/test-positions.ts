import { prisma } from '../src/lib/prisma';
import { exitRule, entryRule } from '../src/lib/describe-strategy';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';
import { formatSignalAlert } from '../src/lib/notify';

async function main() {
  console.log('=== exit rules read back from real strategies ===');
  for (const name of ['Turtle System 2 (55/20)','Weinstein Stage 2 Breakout','Connors RSI(2) Mean Reversion','Minervini Trend Template']) {
    const s = MASTER_STRATEGY_LIBRARY.find((x:any) => x.name === name)!;
    console.log(`\n${name}`);
    console.log(`  BUY  : ${entryRule(s)}`);
    console.log(`  SELL : ${exitRule(s)}`);
  }

  console.log('\n=== position lifecycle ===');
  const u = await prisma.user.create({ data: { email: `pos-${Date.now()}@t.local`, passwordHash: 'x' } });
  const p = await prisma.labPosition.create({
    data: { userId: u.id, symbol: 'RELIANCE.NS', strategyName: 'Turtle System 2 (55/20)',
            entryPrice: 1400, quantity: 10, entryDate: new Date(), stopLossPrice: 1260 },
  });
  console.log(`  opened: 10 @ 1400, stop 1260, invested ${1400*10}`);
  const ltp = 1512;
  console.log(`  at ${ltp}: P&L = ${((ltp-1400)*10).toFixed(0)}  (${(((ltp-1400)/1400)*100).toFixed(1)}%)`);
  console.log(`  stop breached at 1250? ${1250 <= 1260}`);
  await prisma.labPosition.update({ where: { id: p.id }, data: { exitPrice: 1512, exitDate: new Date(), status: 'CLOSED' } });
  const closed = await prisma.labPosition.findUnique({ where: { id: p.id } });
  console.log(`  closed: status=${closed!.status} realised=${((closed!.exitPrice!-closed!.entryPrice)*closed!.quantity).toFixed(0)}`);
  await prisma.user.delete({ where: { id: u.id } });
  console.log(`  cascade cleanup: positions left = ${await prisma.labPosition.count({ where: { userId: u.id } })}`);

  console.log('\n=== telegram alert body ===');
  const s = MASTER_STRATEGY_LIBRARY.find((x:any) => x.name === 'Turtle System 2 (55/20)')!;
  console.log(formatSignalAlert({ symbol:'RELIANCE.NS', strategyName:'Turtle System 2 (55/20)', signal:'NEW_BUY',
    oosWinRate: 68.4, oosTotalTrades: 19, avgHoldingDays: 47, exitRule: exitRule(s), price: 1420.55 })
    .replace(/<[^>]+>/g,''));
  await prisma.$disconnect();
}
main();
