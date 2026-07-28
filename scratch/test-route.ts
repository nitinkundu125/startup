import { POST } from './src/app/api/backtest/batch/route';
import { NextRequest } from 'next/server';

async function test() {
  const req = new NextRequest('http://localhost/api/backtest/batch', {
    method: 'POST',
    body: JSON.stringify({ symbols: ['RELIANCE.NS'] })
  });
  
  // Mock requireValidUser somehow? It will fail auth.
}
