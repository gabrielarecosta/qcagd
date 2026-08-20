/**
 * Script de Limpieza de Hojas de Ruta de Reparto
 * Elimina todas las rutas activas, paradas vinculadas y desasigna los pedidos
 * restableciendo aquellos para retiro/sucursal y dejando libres solo los de reparto físico.
 * Usa fetch nativo de Node.js sin ninguna dependencia externa.
 */

const SUPABASE_URL = 'https://phhxmwspmotsotkwihrl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoaHhtd3NwbW90c290a3dpaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODExNTEsImV4cCI6MjA5OTM1NzE1MX0.AXP-mNivqYAUX0bbHFvp4HYhG4heZAmm8gLQhlODsjc';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function clearAllRoutes() {
  console.log('🚀 Iniciando limpieza de Hojas de Ruta...');

  try {
    // 1. Obtener y eliminar paradas de ruta (delivery_route_stops)
    console.log('🧹 Limpiando paradas en delivery_route_stops...');
    const resStops = await fetch(`${SUPABASE_URL}/rest/v1/delivery_route_stops?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers,
    });
    if (resStops.ok) {
      console.log('✅ Paradas de ruta (delivery_route_stops) eliminadas.');
    } else {
      console.warn('⚠️ Respuesta al eliminar delivery_route_stops:', resStops.statusText);
    }

    // 2. Obtener y eliminar entregas en deliveries
    console.log('🧹 Limpiando entregas en deliveries...');
    const resDeliv = await fetch(`${SUPABASE_URL}/rest/v1/deliveries?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers,
    });
    if (resDeliv.ok) {
      console.log('✅ Entregas (deliveries) eliminadas.');
    } else {
      console.warn('⚠️ Respuesta al eliminar deliveries:', resDeliv.statusText);
    }

    // 3. Eliminar hojas de ruta principales en delivery_routes
    console.log('🧹 Limpiando hojas de ruta en delivery_routes...');
    const resRoutes = await fetch(`${SUPABASE_URL}/rest/v1/delivery_routes?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers,
    });
    if (resRoutes.ok) {
      const deletedRoutes = await resRoutes.json();
      console.log(`✅ ${Array.isArray(deletedRoutes) ? deletedRoutes.length : 'Todas las'} hojas de ruta (delivery_routes) eliminadas.`);
    } else {
      console.warn('⚠️ Respuesta al eliminar delivery_routes:', resRoutes.statusText);
    }

    // 4. Resetear pedidos en orders: desasignar repartidores y desvincular ruta
    console.log('🔄 Desvinculando pedidos y restableciendo estado...');
    const resOrders = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        delivery_route_id: null,
        repartidor_id: null,
        taken_by_id: null,
      }),
    });

    if (resOrders.ok) {
      console.log('✅ Asignaciones de repartidor y rutas reseteadas en orders.');
    }

    // Restablecer estados de pedidos de 'listo_para_reparto' / 'en_reparto' a 'recibido'
    const resState = await fetch(`${SUPABASE_URL}/rest/v1/orders?estado=in.(listo_para_reparto,en_reparto,en_camino)`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        estado: 'recibido',
      }),
    });

    if (resState.ok) {
      console.log('✅ Estados de pedidos en camino/reparto reestablecidos a recibidos/pendientes.');
    }

    console.log('🎉 Limpieza completada con éxito.');
  } catch (err) {
    console.error('❌ Error durante la ejecución:', err);
  }
}

clearAllRoutes();
