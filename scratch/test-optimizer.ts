import { runOptimizer } from './src/lib/optimizer';

async function test() {
  console.log("Testing optimizer on RELIANCE.NS");
  try {
    const results = await runOptimizer('RELIANCE.NS');
    console.log(`Found ${results.length} strategies`);
  } catch (e) {
    console.error(e);
  }
}
test();
