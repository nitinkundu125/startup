import { calculateRSI } from './src/lib/indicators';
import { fetchYahooDailyCloses } from './src/lib/index-history';

async function test() {
  const result = await fetchYahooDailyCloses('NTPC.NS', new Date('1990-01-01'));
  const closes = result.map((r: any) => r.close);
  
  // Calculate RSI with actual Friday close
  let rsi = calculateRSI(closes, 10);
  console.log("RSI on Friday with actual close (361.64):", rsi[rsi.length - 2]); // Friday is index length-2 because Monday is length-1
  
  // Simulate Friday dipping lower (e.g. 355) intraday
  const closesIntraday = [...closes];
  closesIntraday[closesIntraday.length - 2] = 355; // Force Friday close to be lower
  let rsiIntraday = calculateRSI(closesIntraday.slice(0, -1), 10); // Calculate up to Friday
  console.log("RSI on Friday if price was 355 intraday:", rsiIntraday[rsiIntraday.length - 1]);
}
test();
