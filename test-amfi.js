const https = require('https');

https.get('https://query1.finance.yahoo.com/v8/finance/chart/INF846K01EW2.BO?interval=1d&range=1d', (res) => {
  console.log('statusCode:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (e) => {
  console.error(e);
});
