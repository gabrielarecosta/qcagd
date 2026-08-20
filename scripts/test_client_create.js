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
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing client creation payload...');
  const clientId = `test-cli-${Date.now()}`;
  const dbInsert = {
    id: clientId,
    nombre: 'Cliente Prueba Registro',
    razon_social: 'Cliente Prueba Registro',
    cuit: '20334445559',
    telefono: '3584112233',
    whatsapp: '3584112233',
    email: `test_${Date.now()}@gmail.com`,
    direccion: '',
    branch_id: 'branch-gd1',
    tipo_cliente: 'minorista',
    activo: true,
    observaciones: 'Prueba de registro',
    latitude: null,
    longitude: null,
    location_verified: false,
    fecha_alta: new Date().toISOString(),
  };

  const res = await request('POST', 'customers?select=id,nombre,razon_social,cuit,telefono,whatsapp,email,direccion,branch_id,tipo_cliente,activo,observaciones,fecha_alta,latitude,longitude,location_verified', dbInsert);
  console.log('Result:', JSON.stringify(res, null, 2));
}

run().catch(console.error);
