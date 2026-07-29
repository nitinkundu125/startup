import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchYahooDaily } from './index-history.ts';

/**
 * A throttled fetch and a symbol with no history must not look the same.
 *
 * They used to: both returned an empty array. A Nifty 500 scan covered 122
 * stocks, dropped the other 378 without a word, and reported success — the
 * failures were faster than the successes, so it even looked like it sped up.
 */

const START = new Date('2020-01-01');
const realFetch = globalThis.fetch;

/** A Yahoo chart payload with `n` usable daily bars. */
function chartPayload(n: number) {
  const fill = (v: number) => Array.from({ length: n }, () => v);
  return {
    chart: {
      result: [
        {
          timestamp: Array.from({ length: n }, (_, i) => 1_000_000_000 + i * 86_400),
          indicators: {
            quote: [
              { close: fill(100), high: fill(101), low: fill(99), open: fill(100), volume: fill(1000) },
            ],
            adjclose: [{ adjclose: fill(100) }],
          },
        },
      ],
    },
  };
}

type Step = { status?: number; throws?: boolean };

/** Replays `steps` across successive calls, repeating the last one. */
function stubFetch(steps: Step[]) {
  let i = 0;
  const calls = { count: 0 };
  globalThis.fetch = (async () => {
    const step = steps[Math.min(i++, steps.length - 1)];
    calls.count++;
    if (step.throws) throw new Error('network down');
    return new Response(JSON.stringify(chartPayload(200)), { status: step.status ?? 200 });
  }) as typeof globalThis.fetch;
  return calls;
}

describe('fetchYahooDaily outcomes', () => {
  beforeEach(() => { globalThis.fetch = realFetch; });
  afterEach(() => { globalThis.fetch = realFetch; });

  it('reports a persistent throttle as unavailable, after retrying', async () => {
    const calls = stubFetch([{ status: 429 }]);
    const res = await fetchYahooDaily('X.NS', START);
    assert.equal(res.outcome, 'unavailable');
    assert.equal(res.rows.length, 0);
    assert.equal(calls.count, 3, 'should exhaust its attempts before giving up');
  });

  it('recovers when a throttle clears on retry', async () => {
    const calls = stubFetch([{ status: 429 }, { status: 200 }]);
    const res = await fetchYahooDaily('X.NS', START);
    assert.equal(res.outcome, 'ok');
    assert.equal(res.rows.length, 200);
    assert.equal(calls.count, 2);
  });

  it('treats an unknown symbol as no-data, not a fetch failure', async () => {
    const calls = stubFetch([{ status: 404 }]);
    const res = await fetchYahooDaily('DELISTED.NS', START);
    // Index lists carry renamed and delisted tickers. Reporting those as
    // "could not be fetched" blames the rate limit for a dead symbol.
    assert.equal(res.outcome, 'no-data');
    assert.equal(calls.count, 1, '404 is an answer, not a failure to reach Yahoo');
  });

  it('distinguishes an empty series from a failed fetch', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(chartPayload(0)), { status: 200 })) as typeof globalThis.fetch;
    const res = await fetchYahooDaily('X.NS', START);
    assert.equal(res.outcome, 'no-data', 'Yahoo answered; the symbol really has nothing');
  });

  it('treats a network error as unavailable and retries it', async () => {
    const calls = stubFetch([{ throws: true }]);
    const res = await fetchYahooDaily('X.NS', START);
    assert.equal(res.outcome, 'unavailable');
    assert.equal(calls.count, 3);
  });
});
