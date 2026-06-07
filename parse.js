const fs = require('fs');
const content = fs.readFileSync('/Users/nitinkundu/.gemini/antigravity-ide/brain/f114b106-a030-4f94-9b31-e58799f4901a/.system_generated/steps/1912/content.md', 'utf-8');
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('nifty500'));
const symbols = [];
for (let i = startIdx + 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if (parts.length > 3 && parts[3]) {
    symbols.push(parts[3].trim());
  }
}
fs.writeFileSync('src/lib/nifty500.ts', 'export const NIFTY_500_SYMBOLS = ' + JSON.stringify(symbols, null, 2) + ';\n');
console.log('Saved ' + symbols.length + ' symbols to src/lib/nifty500.ts');
