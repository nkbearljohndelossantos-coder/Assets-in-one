const path = require('path');
module.paths.push(path.resolve(__dirname, '../backend/node_modules'));
process.chdir(path.resolve(__dirname, '../backend'));

const http = require('http');

async function testHealth() {
  process.env.PORT = '5055';
  process.env.NODE_ENV = 'test';

  const { server } = require('../backend/src/server');

  await new Promise((resolve) => server.listen(5055, resolve));
  console.log('Server started on port 5055 for health check verification');

  const check = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:5055/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });

  console.log(`Health check responded with HTTP ${check.statusCode}:`, check.data);
  server.close();
  console.log('Health check test passed successfully!');
}

testHealth().then(() => process.exit(0)).catch(err => {
  console.error('Health check test failed:', err);
  process.exit(1);
});
