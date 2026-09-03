/**
 * =============================================================================
 * SCRIPT: deduplicate_products.js (SOLO ANÁLISIS / MODO LECTURA)
 * =============================================================================
 * Este script solo analiza la base de datos y genera el script SQL
 * para que el usuario ejecute la depuración manualmente desde el Editor SQL
 * de Supabase. NO ejecuta comandos DELETE ni UPDATE automáticamente.
 * =============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let SUPABASE_URL = process.env.SUPABASE_URL || '';
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

const adminEnv = path.join(__dirname, '../admin-panel/.env');
if (fs.existsSync(adminEnv)) {
  fs.readFileSync(adminEnv, 'utf8').split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=').slice(1).join('=').trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_KEY = line.split('=').slice(1).join('=').trim();
  });
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Credenciales de Supabase no encontradas.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeCode(c) {
  if (!c) return '';
  let str = String(c).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  return str.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

async function run() {
  console.log('🔍 Modo Lectura / Análisis de Productos Duplicados...');

  let allProducts = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('products')
      .select('id, codigo, nombre, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .range(from, to);

    if (error) {
      console.error('❌ Error leyendo productos:', error.message);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allProducts = allProducts.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    }
  }

  console.log(`📦 Total de productos activos leídos: ${allProducts.length.toLocaleString('es-AR')}`);

  const groupedByCode = new Map();
  allProducts.forEach(p => {
    const code = normalizeCode(p.codigo);
    if (!code) return;
    if (!groupedByCode.has(code)) groupedByCode.set(code, []);
    groupedByCode.get(code).push(p);
  });

  let duplicateGroupsCount = 0;
  const idsToDelete = [];

  groupedByCode.forEach((prods) => {
    if (prods.length > 1) {
      duplicateGroupsCount++;
      prods.sort((a, b) => Number(b.id) - Number(a.id));
      const duplicates = prods.slice(1);
      duplicates.forEach(d => idsToDelete.push(d.id));
    }
  });

  console.log(`\n📊 Diagnóstico de Duplicados:`);
  console.log(`   Códigos únicos encontrados:       ${groupedByCode.size.toLocaleString('es-AR')}`);
  console.log(`   Grupos con productos duplicados:  ${duplicateGroupsCount.toLocaleString('es-AR')}`);
  console.log(`   Total de registros duplicados:    ${idsToDelete.length.toLocaleString('es-AR')}`);

  if (idsToDelete.length === 0) {
    console.log('\n✅ El catálogo no contiene productos duplicados.');
    return;
  }

  console.log('\nℹ️  Para eliminar estos registros manualmente desde Supabase, podés ejecutar este SQL:\n');
  console.log(`UPDATE public.products SET deleted_at = NOW() WHERE id IN (${idsToDelete.join(', ')});`);
}

run().catch(console.error);
