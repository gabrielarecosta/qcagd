/**
 * Script de Limpieza Total de Pedidos y Rutas
 * Trunca todas las tablas de pedidos, ítems, entregas y rutas en Supabase.
 */

const SUPABASE_URL = 'https://phhxmwspmotsotkwihrl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoaHhtd3NwbW90c290a3dpaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODExNTEsImV4cCI6MjA5OTM1NzE1MX0.AXP-mNivqYAUX0bbHFvp4HYhG4heZAmm8gLQhlODsjc';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function clearAllOrders() {
  console.log('🚀 Iniciando VACIADO COMPLETO de pedidos y rutas...');

  const tables = [
    'delivery_route_stops',
    'delivery_events',
    'delivery_assignments',
    'deliveries',
    'delivery_routes',
    'order_status_history',
    'payment_logs',
    'receipts',
    'order_items',
    'orders'
  ];

  for (const table of tables) {
    try {
      console.log(`🧹 Limpiando tabla '${table}'...`);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=neq.00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        console.log(`✅ Tabla '${table}' limpiada con éxito.`);
      } else {
        const text = await res.text();
        console.warn(`⚠️ Nota al limpiar '${table}':`, res.statusText, text);
      }
    } catch (e) {
      console.error(`❌ Error en tabla '${table}':`, e.message);
    }
  }

  console.log('🎉 Limpieza total completada. La base de datos de pedidos quedó vacía de 0.');
}

clearAllOrders();
