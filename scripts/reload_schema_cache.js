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

function executeSql(query) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/rpc/exec_sql`);
    const data = JSON.stringify({ query });
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: responseData }));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Dropping any remaining zona columns and reloading PostgREST schema cache...');
  
  const query = `
    ALTER TABLE public.customers DROP COLUMN IF EXISTS zona;
    ALTER TABLE public.customers DROP COLUMN IF EXISTS zone_id;
    ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_zone;
    ALTER TABLE public.orders DROP COLUMN IF EXISTS zone_id;
    NOTIFY pgrst, 'reload schema';
  `;

  const res = await executeSql(query);
  console.log('Result:', res);
}

run().catch(console.error);
