const fs = require('fs'), path = require('path'), https = require('https');
let supabaseUrl = '', supabaseKey = '';
const adminEnv = path.join(__dirname, '../admin-panel/.env');
if (fs.existsSync(adminEnv)) {
  fs.readFileSync(adminEnv, 'utf8').split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=').slice(1).join('=').trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=').slice(1).join('=').trim();
  });
}
const sql = fs.readFileSync(path.join(__dirname, '../shared/migrations/34_add_activa_to_category_names.sql'), 'utf8');
function executeSql(query) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/rpc/exec_sql`);
    const data = JSON.stringify({ query });
    const options = { hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(options, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, data: d })); });
    req.on('error', reject); req.write(data); req.end();
  });
}
async function run() {
  console.log('Applying Migration 34: Add activa to category_names...');
  const res = await executeSql(sql);
  console.log('Result:', res);
}
run().catch(console.error);
