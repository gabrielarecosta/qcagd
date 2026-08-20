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
  console.log('Fetching orders to check estimated_delivery_shift...');
  const orders = await request('GET', 'orders?select=id,numero,estado,estimated_delivery_shift,delivery_method');
  console.log('Found orders:', orders.length);

  for (const o of orders) {
    const shift = o.estimated_delivery_shift;
    console.log(`Order #${o.numero} (${o.id}): status=${o.estado}, shift="${shift}", method=${o.delivery_method}`);

    // Standardize shifts if needed
    let normalized = shift;
    if (shift) {
      const lower = shift.toLowerCase();
      if (lower.includes('manana') || lower.includes('mañana') || lower.includes('morning') || lower.includes('slot-morning')) {
        normalized = '08:00 - 12:00 (Mañana)';
      } else if (lower.includes('mediodia') || lower.includes('mediodía') || lower.includes('siesta') || lower.includes('midday')) {
        normalized = '12:00 - 16:00 (Mediodía)';
      } else if (lower.includes('tarde') || lower.includes('afternoon') || lower.includes('noche')) {
        normalized = '16:00 - 20:00 (Tarde)';
      }
    } else {
      normalized = '08:00 - 12:00 (Mañana)';
    }

    if (normalized !== shift) {
      await request('PATCH', `orders?id=eq.${o.id}`, { estimated_delivery_shift: normalized });
      console.log(`  -> Updated order #${o.numero} shift to: "${normalized}"`);
    }
  }

  console.log('Order shifts normalization complete!');
}

run().catch(console.error);
