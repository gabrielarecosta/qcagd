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
  console.log('Fetching branches...');
  let branches = await request('GET', 'branches?select=*');
  console.log('Current branches:', branches);

  if (!Array.isArray(branches) || branches.length === 0) {
    console.log('Seeding default Central Branch...');
    const defaultBranch = {
      id: 'branch-gd1',
      nombre: 'GENERAL DEHEZA - CASA CENTRAL',
      direccion: 'Entre Ríos 151, General Deheza, Córdoba',
      telefono: '0358 405-1234',
      whatsapp: '5493584051234',
      horario_atencion: 'Lunes a Viernes 08:00 a 18:00 hs',
      activo: true,
      latitude: -32.7650,
      longitude: -63.7860,
    };
    const created = await request('POST', 'branches', defaultBranch);
    console.log('Created central branch:', created);
  } else {
    for (const b of branches) {
      const updates = {
        direccion: b.direccion || 'Entre Ríos 151, General Deheza, Córdoba',
        latitude: b.latitude || -32.7650,
        longitude: b.longitude || -63.7860,
      };
      const res = await request('PATCH', `branches?id=eq.${b.id}`, updates);
      console.log(`Updated branch ${b.nombre} (${b.id}):`, res);
    }
  }

  console.log('Migration 23 finished successfully!');
}

run().catch(console.error);
