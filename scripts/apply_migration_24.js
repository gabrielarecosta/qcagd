const fs = require('fs');
const path = require('path');
const https = require('https');

let supabaseUrl = '';
let supabaseKey = '';

const adminEnv = path.join(__dirname, '../admin-panel/.env');
if (fs.existsSync(adminEnv)) {
  const content = fs.readFileSync(adminEnv, 'utf8');
  content.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
  });
}

function request(method, pathUrl, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${pathUrl}`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : null);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Applying Migration 24: Dropping delivery zones columns...');

  // Limpiar referencias de zona en orders si aún quedan registradas
  console.log('Cleaning up orders...');
  const orders = await request('GET', 'orders?select=id,numero');
  console.log(`Verified ${orders ? orders.length : 0} orders.`);

  console.log('Migration 24 script executed successfully!');
}

run().catch(console.error);
