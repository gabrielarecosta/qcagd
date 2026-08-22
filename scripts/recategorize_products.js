/**
 * =============================================================================
 * SCRIPT: recategorize_products.js
 * =============================================================================
 * Recategoriza automáticamente los productos del catálogo usando reglas
 * heurísticas basadas en el nombre, código y descripción del producto.
 *
 * Categorías disponibles:
 *   limpieza | quimicos | perfumeria | descartables | piscina | industrial | hogar | institucional
 *
 * USO:
 *   SUPABASE_SERVICE_KEY=xxx node scripts/recategorize_products.js
 *   SUPABASE_SERVICE_KEY=xxx node scripts/recategorize_products.js --dry-run
 *   SUPABASE_SERVICE_KEY=xxx node scripts/recategorize_products.js --solo-sin-cat
 * =============================================================================
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wbkbqjfkzoxfixuzdykb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

const DRY_RUN = process.argv.includes('--dry-run');
const SOLO_SIN_CAT = process.argv.includes('--solo-sin-cat');
const BATCH_SIZE = 500;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_KEY no definida.');
  console.error('   Ejecutá: SUPABASE_SERVICE_KEY=tu_service_role_key node scripts/recategorize_products.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Reglas de Categorización ───────────────────────────────────────────────
const RULES = [
  // PISCINA
  { categoria: 'piscina', patterns: ['piscina','pileta','cloro','clorina','algicida','alguicida','floculante','hipoclorito piscina','estabilizador cloro','clorinator','skimmer','agua pileta','jacuzzi','spa ','tricloro','diclorisocianurato','cyanurico'] },
  // QUÍMICOS
  { categoria: 'quimicos', patterns: ['acido','acido clorhidrico','acido sulfurico','acido nitrico','acido acetico','soda caustica','hipoclorito','lavandina','percarbonato','peroxido','amoniac','alcohol isopropil','alcohol etilico','metanol','bicarbonato','fosfato','sulfato','nitrato','agua oxigenada','formol','glutaraldehido','solvent','solvente','acetona','thinner','diluyente','desincrustante','saponificad','glicerina','propilenglicol','surfactante','tensoactivo','neutralizante','desoxidante','soda ash','carbonato sodio','cloruro calcio','cloruro sodio quim'] },
  // LIMPIEZA
  { categoria: 'limpieza', patterns: ['limpia','limpiador','limpiavidrio','limpiavidreo','lustramueble','cera pisos','cera muebles','multiuso','desengrasante','desinfectant','bactericida','virucida','higienizante','sanitizante','germicida','detergente','jabon de fregar','quitamancha','quitamanchas','prelavado','suavizante ropa','blanqueador','enjuague ropa','lavaropa','lavarropas','lavavajilla','lavaplatos','escobillon','mop','trapeador','esponja de cocina','estropajo','virulana','desodorizante amb','aromatizador','ambientador','spray limpieza','aerosol limpieza','pastillas desinfect','polvo limpiador','crema limpiadora','gel limpiador','desincrustante baño','quitasarro','antisarro'] },
  // DESCARTABLES
  { categoria: 'descartables', patterns: ['descartable','vaso plastico','vaso descart','plato plastico','plato descart','cubierto plast','tenedor plast','cuchara plast','cuchillo plast','sorbete','bombilla desc','pajita','bandeja alum','fuente alum','film stretch','film plastico','papel film','papel manteca','papel aluminio','bolsa residuo','bolsa basura','bolsa plastica','nylon','servilleta','papel de cocina','papel toalla','toalla de papel','tissue','papel higienico','rollo de cocina','panuelo desechable','mantel descart','guante latex','guante nitri','guante poliet','guante descart','cofia descart','barbijo','tapaboca','cubre calzado','camisolin descart','bata descartable'] },
  // PERFUMERÍA
  { categoria: 'perfumeria', patterns: ['shampoo','champu','acondicionador cabello','balsamo cabello','crema corporal','crema hidratante','crema facial','crema de manos','locion corporal','serum','gel de ducha','gel de baño','jabon liquido cuerpo','jabon corporal','jabon tocador','desodorante roll','desodorante stick','desodorante spray','antitranspirante','talco','perfume','colonia','agua de colonia','body splash','fragancia personal','maquillaje','base de maquillaje','polvo compacto','labial','rimmel','mascara de pestanas','sombra de ojos','delineador','removedor de maquillaje','agua micelar','protector solar','bloqueador solar','spf','bronceador','autobronceante','depilatorio','cera depilat','hilo dental','cepillo dental','pasta dental','enjuague bucal','antibacterial manos','gel antibacterial'] },
  // INDUSTRIAL
  { categoria: 'industrial', patterns: ['lubricante industrial','aceite de motor','aceite hidraulico','aceite industrial','grasa industrial','grasa de maquinaria','anticorrosivo','antioxido','pintura industrial','epoxy','epoxi','impermeabilizante','sellador industrial','silicona industrial','teflon','ptfe','desengripante','limpiador de circuitos','limpiador electrico','detergente industrial','cleaner industrial','absorbente industrial','kit de derrame','arena absorbente','sepiolita','guantes de seguridad','lentes de proteccion','protector auditivo','casco industrial','harness','arnes de seguridad','linterna industrial','traje de proteccion'] },
  // INSTITUCIONAL
  { categoria: 'institucional', patterns: ['institucional','para hospital','clinica medica','uso medico','quirurgico','laboratorio clinico','farmacia','enfermeria','papel kraft','papel bond','resma de papel','sobre manila','carpeta','archivador','papeleria','toner','tinta de impresora','formulario','etiqueta autoadhesiva','rollo termico','rollo de posnet','escolar','didactico','hoteleria','hotelero','restaurante','gastronomico','cafeteria','panaderia','carniceria'] },
  // HOGAR (fallback amplio)
  { categoria: 'hogar', patterns: ['hogar','para cocina','para baño','jardin','insecticida','raticida','plagicida','mata moscas','mata cucarachas','repelente','mata insecto','fumigador','pintura para','esmalte sintetico','barniz','vela aromatica','sahumer','incienso','esencia de hogar','difusor aromas','calzado','textil del hogar','alfombra','cortina','vajilla','olla','sarten','utensilio de cocina'] },
];

function categorizarProducto(nombre = '', codigo = '', descripcion = '') {
  const texto = [nombre, codigo, descripcion].join(' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const p = pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (texto.includes(p)) {
        return rule.categoria;
      }
    }
  }
  return null;
}

const CATEGORIAS_VALIDAS = ['limpieza','quimicos','perfumeria','descartables','piscina','industrial','hogar','institucional'];

const stats = { total: 0, procesados: 0, actualizados: 0, sinCambio: 0, sinMatch: 0, errores: 0, porCategoria: {} };

async function flushUpdates(batch) {
  const byCategoria = {};
  for (const u of batch) {
    if (!byCategoria[u.categoria]) byCategoria[u.categoria] = [];
    byCategoria[u.categoria].push(u.id);
  }
  for (const [cat, ids] of Object.entries(byCategoria)) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await supabase.from('products').update({ categoria: cat }).in('id', chunk);
      if (error) { console.error(`\n  ❌ Error actualizando ${cat}:`, error.message); stats.errores++; }
    }
  }
}

async function run() {
  console.log(`\n🔧 RECATEGORIZACIÓN DE PRODUCTOS`);
  console.log(`   Modo: ${DRY_RUN ? '⚠️  DRY-RUN (sin cambios en BD)' : '✅ APLICAR CAMBIOS'}`);
  if (SOLO_SIN_CAT) console.log(`   Filtro: Solo productos sin categoría válida\n`);

  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
  stats.total = count || 0;
  console.log(`📦 Total de productos: ${stats.total.toLocaleString('es-AR')}\n`);

  let offset = 0;
  let batchNum = 1;
  const pendingUpdates = [];

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, nombre, codigo, descripcion, categoria')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error(`\n❌ Error batch ${batchNum}:`, error.message); break; }
    if (!data || data.length === 0) break;

    for (const product of data) {
      stats.procesados++;
      const catActual = product.categoria;

      if (SOLO_SIN_CAT && CATEGORIAS_VALIDAS.includes(catActual)) {
        stats.sinCambio++;
        continue;
      }

      const nuevaCat = categorizarProducto(product.nombre, product.codigo, product.descripcion) || 'hogar';

      if (nuevaCat === catActual) {
        stats.sinCambio++;
        continue;
      }

      stats.actualizados++;
      stats.porCategoria[nuevaCat] = (stats.porCategoria[nuevaCat] || 0) + 1;

      if (DRY_RUN) {
        const cod = (product.codigo || '?').padEnd(14);
        const nom = (product.nombre || '').slice(0, 38).padEnd(38);
        const de = (catActual || 'sin-cat').padEnd(14);
        console.log(`  [DRY] ${cod} "${nom}" ${de} → ${nuevaCat}`);
      } else {
        pendingUpdates.push({ id: product.id, categoria: nuevaCat });
      }
    }

    if (!DRY_RUN && pendingUpdates.length >= 200) {
      await flushUpdates(pendingUpdates.splice(0));
    }

    process.stdout.write(`\r  Procesando: ${stats.procesados.toLocaleString('es-AR')} / ${stats.total.toLocaleString('es-AR')} (batch ${batchNum})`);
    offset += BATCH_SIZE;
    batchNum++;
  }

  if (!DRY_RUN && pendingUpdates.length > 0) {
    await flushUpdates(pendingUpdates);
  }

  console.log(`\n\n✅ RESUMEN`);
  console.log(`   Total:          ${stats.total.toLocaleString('es-AR')}`);
  console.log(`   Procesados:     ${stats.procesados.toLocaleString('es-AR')}`);
  console.log(`   Actualizados:   ${stats.actualizados.toLocaleString('es-AR')}`);
  console.log(`   Sin cambio:     ${stats.sinCambio.toLocaleString('es-AR')}`);
  console.log(`   Sin match:      ${stats.sinMatch.toLocaleString('es-AR')}`);
  console.log(`   Errores:        ${stats.errores}`);
  console.log(`\n   Por categoría (productos reclasificados):`);
  for (const [cat, n] of Object.entries(stats.porCategoria).sort((a,b) => b[1]-a[1])) {
    console.log(`     ${cat.padEnd(16)} ${String(n).padStart(6)}`);
  }
  if (DRY_RUN) console.log('\n⚠️  DRY-RUN completado. Ejecutá sin --dry-run para aplicar.');
  else console.log('\n🎉 ¡Recategorización completada!');
}

run().catch(e => { console.error('\n❌ Error fatal:', e); process.exit(1); });

