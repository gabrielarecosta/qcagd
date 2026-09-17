import React, { useState, useEffect, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import { companySettingsService, supabase, localidadService, Localidad } from '@shared/services';

interface AppBanner {
  id: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  linkDestino: string;
  activo: boolean;
}

interface CategoryConfigItem {
  id: string;
  nombre: string;
  catKey: string;
  activa: boolean;
  itemsCount: number;
}

const DEFAULT_RULES: Record<string, string[]> = {
  piscina: ['piscina','pileta','cloro','clorina','algicida','alguicida','floculante','hipoclorito piscina','estabilizador cloro','clorinator','skimmer','agua pileta','jacuzzi','spa','tricloro','diclorisocianurato','cyanurico'],
  quimicos: ['acido','acido clorhidrico','acido sulfurico','acido nitrico','acido acetico','soda caustica','hipoclorito','lavandina','percarbonato','peroxido','amoniac','alcohol isopropil','alcohol etilico','metanol','bicarbonato','fosfato','sulfato','nitrato','agua oxigenada','formol','glutaraldehido','solvent','solvente','acetona','thinner','diluyente','desincrustante','saponificad','glicerina','propilenglicol','surfactante','tensoactivo','neutralizante','desoxidante','soda ash','carbonato sodio','cloruro calcio','cloruro sodio quim'],
  limpieza: ['limpia','limpiador','limpiavidrio','limpiavidreo','lustramueble','cera pisos','cera muebles','multiuso','desengrasante','desinfectant','bactericida','virucida','higienizante','sanitizante','germicida','detergente','jabon de fregar','quitamancha','quitamanchas','prelavado','suavizante ropa','blanqueador','enjuague ropa','lavaropa','lavarropas','lavavajilla','lavaplatos','escobillon','mop','trapeador','esponja de cocina','estropajo','virulana','desodorizante amb','aromatizador','ambientador','spray limpieza','aerosol limpieza','pastillas desinfect','polvo limpiador','crema limpiadora','gel limpiador','desincrustante baño','quitasarro','antisarro'],
  descartables: ['descartable','vaso plastico','vaso descart','plato plastico','plato descart','cubierto plast','tenedor plast','cuchara plast','cuchillo plast','sorbete','bombilla desc','pajita','bandeja alum','fuente alum','film stretch','film plastico','papel film','papel manteca','papel aluminio','bolsa residuo','bolsa basura','bolsa plastica','nylon','servilleta','papel de cocina','papel toalla','toalla de papel','tissue','papel higienico','rollo de cocina','panuelo desechable','mantel descart','guante latex','guante nitri','guante poliet','guante descart','cofia descart','barbijo','tapaboca','cubre calzado','camisolin descart','bata descartable'],
  perfumeria: ['shampoo','champu','acondicionador cabello','balsamo cabello','crema corporal','crema hidratante','crema facial','crema de manos','locion corporal','serum','gel de ducha','gel de baño','jabon liquido cuerpo','jabon corporal','jabon tocador','desodorante roll','desodorante stick','desodorante spray','antitranspirante','talco','perfume','colonia','agua de colonia','body splash','fragancia personal','maquillaje','base de maquillaje','polvo compacto','labial','rimmel','mascara de pestanas','sombra de ojos','delineador','removedor de maquillaje','agua micelar','protector solar','bloqueador solar','spf','bronceador','autobronceante','depilatorio','cera depilat','hilo dental','cepillo dental','pasta dental','enjuague bucal','antibacterial manos','gel antibacterial'],
  industrial: ['lubricante industrial','aceite de motor','aceite hidraulico','aceite industrial','grasa industrial','grasa de maquinaria','anticorrosivo','antioxido','pintura industrial','epoxy','epoxi','impermeabilizante','sellador industrial','silicona industrial','teflon','ptfe','desengripante','limpiador de circuitos','limpiador electrico','detergente industrial','cleaner industrial','absorbente industrial','kit de derrame','arena absorbente','sepiolita','guantes de seguridad','lentes de proteccion','protector auditivo','casco industrial','harness','arnes de seguridad','linterna industrial','traje de proteccion'],
  institucional: ['institucional','para hospital','clinica medica','uso medico','quirurgico','laboratorio clinico','farmacia','enfermeria','papel kraft','papel bond','resma de papel','sobre manila','carpeta','archivador','papeleria','toner','tinta de impresora','formulario','etiqueta autoadhesiva','rollo termico','rollo de posnet','escolar','didactico','hoteleria','hotelero','restaurante','gastronomico','cafeteria','panaderia','carniceria'],
  hogar: ['hogar','para cocina','para baño','jardin','insecticida','raticida','plagicida','mata moscas','mata cucarachas','repelente','mata insecto','fumigador','pintura para','esmalte sintetico','barniz','vela aromatica','sahumer','incienso','esencia de hogar','difusor aromas','calzado','textil del hogar','alfombra','cortina','vajilla','olla','sarten','utensilio de cocina']
};

export function ClientConfigView() {
  const { branches, fetchData } = useAdminStore();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'categorias' | 'recategorizacion' | 'localidades'>('categorias');

  // Localidades state
  const [localidadesList, setLocalidadesList] = useState<Localidad[]>([]);
  const [loadingLocalidades, setLoadingLocalidades] = useState(false);
  const [isAddLocalidadModalOpen, setIsAddLocalidadModalOpen] = useState(false);
  const [newLocNombre, setNewLocNombre] = useState('');
  const [newLocProvincia, setNewLocProvincia] = useState('Córdoba');
  const [newLocCP, setNewLocCP] = useState('');
  const [isSubmittingLoc, setIsSubmittingLoc] = useState(false);

  const loadLocalidades = async () => {
    setLoadingLocalidades(true);
    try {
      const list = await localidadService.getAll();
      setLocalidadesList(list);
    } catch (e) {
      console.error('Error cargando localidades:', e);
    } finally {
      setLoadingLocalidades(false);
    }
  };

  const handleUpdateLocalidadBranch = async (locId: string, branchId?: number) => {
    try {
      await localidadService.update(locId, { branchId });
      setLocalidadesList(prev => prev.map(l => l.id === locId ? { ...l, branchId } : l));
    } catch (e) {
      console.error('Error actualizando sucursal de localidad:', e);
    }
  };


  useEffect(() => {
    loadLocalidades();
  }, []);

  const handleCreateLocalidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocNombre.trim()) {
      alert('Por favor ingrese el nombre de la localidad.');
      return;
    }
    setIsSubmittingLoc(true);
    try {
      await localidadService.create({
        nombre: newLocNombre.trim(),
        provincia: newLocProvincia.trim() || 'Córdoba',
        codigoPostal: newLocCP.trim(),
        activa: true,
        repartoHabilitado: true,
      });
      alert(`Localidad "${newLocNombre.trim()}" dada de alta exitosamente.`);
      setNewLocNombre('');
      setNewLocCP('');
      setIsAddLocalidadModalOpen(false);
      await loadLocalidades();
    } catch (err: any) {
      alert('Error al crear la localidad: ' + (err.message || String(err)));
    } finally {
      setIsSubmittingLoc(false);
    }
  };

  const handleToggleLocalidadActiva = async (loc: Localidad) => {
    try {
      const nuevoEstado = !loc.activa;
      await localidadService.update(loc.id, { activa: nuevoEstado });
      setLocalidadesList(prev => prev.map(l => l.id === loc.id ? { ...l, activa: nuevoEstado } : l));
    } catch (e) {
      console.error('Error al actualizar localidad:', e);
    }
  };

  const handleToggleLocalidadReparto = async (loc: Localidad) => {
    try {
      const nuevoReparto = !loc.repartoHabilitado;
      await localidadService.update(loc.id, { repartoHabilitado: nuevoReparto });
      setLocalidadesList(prev => prev.map(l => l.id === loc.id ? { ...l, repartoHabilitado: nuevoReparto } : l));
    } catch (e) {
      console.error('Error al actualizar reparto de localidad:', e);
    }
  };

  const handleDeleteLocalidad = async (loc: Localidad) => {
    if (!confirm(`¿Eliminar la localidad "${loc.nombre}"?`)) return;
    try {
      await localidadService.delete(loc.id);
      setLocalidadesList(prev => prev.filter(l => l.id !== loc.id));
    } catch (e) {
      console.error('Error al eliminar localidad:', e);
    }
  };

  // Categories list state
  const [categoriesConfig, setCategoriesConfig] = useState<CategoryConfigItem[]>([]);
  const [categoryBanners, setCategoryBanners] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  // Category Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCatNombre, setNewCatNombre] = useState('');
  const [newCatKey, setNewCatKey] = useState('');
  const [newCatImagen, setNewCatImagen] = useState('');
  const [newCatPatrones, setNewCatPatrones] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  // Category Rules state (mapping catKey -> array of pattern strings)
  const [rulesMap, setRulesMap] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('qca_category_rules');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return DEFAULT_RULES;
  });

  const [selectedRuleCategory, setSelectedRuleCategory] = useState<string>('limpieza');
  const [newPatternInput, setNewPatternInput] = useState('');

  // Auto-recategorization state
  const [onlySinCat, setOnlySinCat] = useState(true);
  const [isDryRun, setIsDryRun] = useState(false);
  const [isProcessingAutoCat, setIsProcessingAutoCat] = useState(false);
  const [autoCatProgress, setAutoCatProgress] = useState<{ current: number; total: number } | null>(null);
  const [autoCatResults, setAutoCatResults] = useState<{
    total: number;
    processed: number;
    updated: number;
    unchanged: number;
    noMatch: number;
    errors: number;
    byCategory: Record<string, number>;
  } | null>(null);

  // App Banners
  const [banners, setBanners] = useState<AppBanner[]>([
    { 
      id: 'b-1', 
      titulo: 'Oferta Especial Otoño', 
      subtitulo: 'Bidón de Cloro Concentrado 10L con 20% OFF', 
      imagen: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      linkDestino: 'prod-cloro-10l',
      activo: true 
    },
    { 
      id: 'b-2', 
      titulo: 'Productos de Piscina', 
      subtitulo: 'Prepará tu pileta para la temporada baja', 
      imagen: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=600&q=80',
      linkDestino: 'cat-piscina',
      activo: true 
    },
    { 
      id: 'b-3', 
      titulo: 'Mayorista Descartables', 
      subtitulo: 'Precios especiales en compras por bulto cerrado', 
      imagen: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
      linkDestino: 'cat-descartables',
      activo: false 
    }
  ]);

  const [editingBanner, setEditingBanner] = useState<AppBanner | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('upload');

  // App General Configs
  const [generalConfig, setGeneralConfig] = useState({
    nombreApp: 'Química General Deheza',
    telefonoSoporte: '5493511234567',
    emailSoporte: 'soporte@quimicadeheza.com.ar',
    mensajeBienvenida: '¡Bienvenido a nuestra distribuidora! Realizá tu pedido fácil y rápido.',
    habilitarVentaMinorista: true,
    habilitarVentaMayorista: true,
    direccion: 'Bv. San Martín 123, General Deheza',
    telefono: '3584123456',
    instagram: 'quimica_deheza',
    facebook: 'quimicadeheza',
  });

  // Load category banners & names from Supabase
  const loadCategoryData = async () => {
    try {
      const { data: bannerData } = await supabase
        .from('category_banners')
        .select('*');
      if (bannerData) {
        const map: Record<string, string> = {};
        bannerData.forEach((b: any) => { map[b.categoria] = b.imagen; });
        setCategoryBanners(map);
      }

      // Load category_names
      const { data: nameData } = await supabase
        .from('category_names')
        .select('*')
        .order('categoria', { ascending: true });

      // Load rules from category_rules if present
      try {
        const { data: rulesData } = await supabase.from('category_rules').select('*');
        if (rulesData && rulesData.length > 0) {
          const map: Record<string, string[]> = {};
          rulesData.forEach((r: any) => {
            if (!map[r.categoria]) map[r.categoria] = [];
            if (!map[r.categoria].includes(r.pattern)) map[r.categoria].push(r.pattern);
          });
          // Merge with defaults
          setRulesMap(prev => ({ ...DEFAULT_RULES, ...prev, ...map }));
        }
      } catch (_) {}

      if (nameData && nameData.length > 0) {
        const map: Record<string, string> = {};
        nameData.forEach((n: any) => { map[n.categoria] = n.nombre; });
        setCategoryNames(map);

        // Count products per category
        const { data: countData } = await supabase
          .from('products')
          .select('categoria')
          .eq('activo', true);

        const counts: Record<string, number> = {};
        (countData || []).forEach((p: any) => {
          counts[p.categoria] = (counts[p.categoria] || 0) + 1;
        });

        const config = nameData.map((n: any, idx: number) => ({
          id: String(n.id || idx + 1),
          nombre: n.nombre,
          catKey: n.categoria,
          activa: n.activa !== false,
          itemsCount: counts[n.categoria] || 0,
        }));
        setCategoriesConfig(config);
      } else {
        // Fallback default categories if table is empty
        const defaultCats = [
          { id: '1', nombre: 'Limpieza e Higiene', catKey: 'limpieza', activa: true, itemsCount: 0 },
          { id: '2', nombre: 'Químicos Industriales', catKey: 'quimicos', activa: true, itemsCount: 0 },
          { id: '3', nombre: 'Perfumería y Cuidado', catKey: 'perfumeria', activa: true, itemsCount: 0 },
          { id: '4', nombre: 'Descartables & Papelería', catKey: 'descartables', activa: true, itemsCount: 0 },
          { id: '5', nombre: 'Mantenimiento de Piscina', catKey: 'piscina', activa: true, itemsCount: 0 },
          { id: '6', nombre: 'Seguridad Industrial', catKey: 'industrial', activa: true, itemsCount: 0 },
          { id: '7', nombre: 'Línea Hogar y Jardín', catKey: 'hogar', activa: true, itemsCount: 0 },
          { id: '8', nombre: 'Uso Institucional', catKey: 'institucional', activa: true, itemsCount: 0 },
        ];
        setCategoriesConfig(defaultCats);
      }
    } catch (e) {
      console.error('Error loading category data:', e);
    }
  };

  useEffect(() => {
    loadCategoryData();
  }, []);

  // Save rules to localStorage & state
  const saveRulesMap = (updated: Record<string, string[]>) => {
    setRulesMap(updated);
    localStorage.setItem('qca_category_rules', JSON.stringify(updated));
  };

  // Add rule/pattern to a category
  const handleAddPattern = async (catKey: string, patternRaw: string) => {
    const p = patternRaw.trim().toLowerCase();
    if (!p) return;
    const currentPatterns = rulesMap[catKey] || [];
    if (currentPatterns.includes(p)) {
      alert('Esa regla/patrón ya existe para esta categoría.');
      return;
    }
    const updated = {
      ...rulesMap,
      [catKey]: [...currentPatterns, p]
    };
    saveRulesMap(updated);
    setNewPatternInput('');

    // Try persisting to DB table category_rules
    try {
      await supabase.from('category_rules').upsert({
        categoria: catKey,
        pattern: p
      }, { onConflict: 'categoria,pattern' });
    } catch (_) {}
  };

  // Remove rule/pattern from a category
  const handleRemovePattern = async (catKey: string, patternToRemove: string) => {
    const currentPatterns = rulesMap[catKey] || [];
    const updatedPatterns = currentPatterns.filter(p => p !== patternToRemove);
    const updated = {
      ...rulesMap,
      [catKey]: updatedPatterns
    };
    saveRulesMap(updated);

    // Try deleting from DB table category_rules
    try {
      await supabase.from('category_rules').delete().match({ categoria: catKey, pattern: patternToRemove });
    } catch (_) {}
  };

  // Save category name
  const saveCategoryName = async (categoria: string, nuevoNombre: string) => {
    try {
      const { error } = await supabase
        .from('category_names')
        .upsert({
          categoria,
          nombre: nuevoNombre,
          updated_at: new Date().toISOString()
        }, { onConflict: 'categoria' });
      if (error) {
        console.error('Error saving category name:', error);
      } else {
        setCategoryNames(prev => ({ ...prev, [categoria]: nuevoNombre }));
      }
    } catch (e) {
      console.error('Error saving category name:', e);
    }
  };

  const saveCategoryBanner = async (categoria: string, url: string) => {
    try {
      const { error } = await supabase
        .from('category_banners')
        .upsert({
          categoria,
          imagen: url,
          updated_at: new Date().toISOString()
        }, { onConflict: 'categoria' });
      if (error) {
        console.error('Error saving category banner:', error);
        alert('Error al guardar banner: ' + error.message);
      } else {
        setCategoryBanners(prev => ({ ...prev, [categoria]: url }));
      }
    } catch (e) {
      console.error('Error saving category banner:', e);
    }
  };

  const handleCategoryUpload = async (categoria: string, file: File) => {
    setUploadingCategory(categoria);
    try {
      const ext = file.name.split('.').pop();
      const path = `categories/${categoria}_${Date.now()}.${ext}`;
      let { error: upErr } = await supabase.storage
        .from('app-assets')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr && (upErr.message?.toLowerCase().includes('bucket not found') || (upErr as any).statusCode === '404')) {
        try {
          await supabase.storage.createBucket('app-assets', { public: true });
          const retryRes = await supabase.storage
            .from('app-assets')
            .upload(path, file, { upsert: true, contentType: file.type });
          upErr = retryRes.error;
        } catch (_) {}
      }

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('app-assets')
        .getPublicUrl(path);
      await saveCategoryBanner(categoria, urlData.publicUrl);
    } catch (err: any) {
      alert('Error al subir imagen: ' + (err.message || String(err)));
    } finally {
      setUploadingCategory(null);
    }
  };

  // Toggle Category Active state
  const handleToggleCategory = async (id: string) => {
    const cat = categoriesConfig.find(c => c.id === id);
    if (!cat) return;
    const newActiva = !cat.activa;
    setCategoriesConfig(prev => prev.map(c => c.id === id ? { ...c, activa: newActiva } : c));
    try {
      const { error } = await supabase
        .from('category_names')
        .update({ activa: newActiva })
        .eq('categoria', cat.catKey);
      if (error) console.warn('No se pudo guardar activa en BD:', error.message);
    } catch (e) {
      console.warn('Error guardando estado de categoría:', e);
    }
  };

  // Create new Category Modal Handler
  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNombre.trim()) {
      alert('Por favor ingrese un nombre para la categoría.');
      return;
    }
    const catKey = (newCatKey.trim() || newCatNombre.trim())
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');

    setIsSubmittingCat(true);

    try {
      // Upsert into category_names
      const { error: catErr } = await supabase
        .from('category_names')
        .upsert({
          categoria: catKey,
          nombre: newCatNombre.trim(),
          activa: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'categoria' });

      if (catErr) {
        console.warn('Advertencia al guardar category_name en Supabase:', catErr.message);
      }

      // Save banner if provided
      if (newCatImagen.trim()) {
        await saveCategoryBanner(catKey, newCatImagen.trim());
      }

      // Add patterns if provided
      if (newCatPatrones.trim()) {
        const patternsArr = newCatPatrones
          .split(',')
          .map(p => p.trim().toLowerCase())
          .filter(Boolean);

        const updatedPatterns = [...(rulesMap[catKey] || [])];
        for (const p of patternsArr) {
          if (!updatedPatterns.includes(p)) updatedPatterns.push(p);
          try {
            await supabase.from('category_rules').upsert({ categoria: catKey, pattern: p }, { onConflict: 'categoria,pattern' });
          } catch (_) {}
        }
        saveRulesMap({ ...rulesMap, [catKey]: updatedPatterns });
      } else if (!rulesMap[catKey]) {
        saveRulesMap({ ...rulesMap, [catKey]: [catKey] });
      }

      // Update local state
      await loadCategoryData();

      setIsAddCategoryModalOpen(false);
      setNewCatNombre('');
      setNewCatKey('');
      setNewCatImagen('');
      setNewCatPatrones('');
      alert(`✅ Categoría "${newCatNombre.trim()}" creada con éxito.`);
    } catch (err: any) {
      alert('Error al crear la categoría: ' + (err.message || String(err)));
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Auto-Categorization Algorithm
  const categorizarProducto = (nombre: string = '', codigo: string = '', descripcion: string = ''): string | null => {
    const texto = [nombre, codigo, descripcion]
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    for (const [catKey, patterns] of Object.entries(rulesMap)) {
      for (const pattern of patterns) {
        if (!pattern || !pattern.trim()) continue;
        const p = pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (texto.includes(p)) {
          return catKey;
        }
      }
    }
    return null;
  };

  // Run Auto-Recategorization Execution
  const handleRunAutoRecategorization = async () => {
    setIsProcessingAutoCat(true);
    setAutoCatResults(null);

    const stats = {
      total: 0,
      processed: 0,
      updated: 0,
      unchanged: 0,
      noMatch: 0,
      errors: 0,
      byCategory: {} as Record<string, number>
    };

    try {
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
      stats.total = count || 0;
      setAutoCatProgress({ current: 0, total: stats.total });

      const BATCH_SIZE = 200;
      let offset = 0;
      const pendingUpdates: { id: string; categoria: string }[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id, nombre, codigo, descripcion, categoria')
          .range(offset, offset + BATCH_SIZE - 1);

        if (error || !data || data.length === 0) break;

        for (const product of data) {
          stats.processed++;
          const catActual = product.categoria;

          // If filtering only without category and already has valid category
          if (onlySinCat && catActual && Object.keys(rulesMap).includes(catActual)) {
            stats.unchanged++;
            continue;
          }

          const nuevaCat = categorizarProducto(product.nombre, product.codigo, product.descripcion) || 'hogar';

          if (nuevaCat === catActual) {
            stats.unchanged++;
            continue;
          }

          stats.updated++;
          stats.byCategory[nuevaCat] = (stats.byCategory[nuevaCat] || 0) + 1;

          if (!isDryRun) {
            pendingUpdates.push({ id: product.id, categoria: nuevaCat });
          }
        }

        // Flush batch updates if not dry run
        if (!isDryRun && pendingUpdates.length >= 100) {
          const chunk = pendingUpdates.splice(0, 100);
          const byCat: Record<string, string[]> = {};
          chunk.forEach(u => {
            if (!byCat[u.categoria]) byCat[u.categoria] = [];
            byCat[u.categoria].push(u.id);
          });
          for (const [cat, ids] of Object.entries(byCat)) {
            const { error: upErr } = await supabase.from('products').update({ categoria: cat }).in('id', ids);
            if (upErr) stats.errors++;
          }
        }

        setAutoCatProgress({ current: stats.processed, total: stats.total });
        offset += BATCH_SIZE;
      }

      // Flush remaining updates
      if (!isDryRun && pendingUpdates.length > 0) {
        const byCat: Record<string, string[]> = {};
        pendingUpdates.forEach(u => {
          if (!byCat[u.categoria]) byCat[u.categoria] = [];
          byCat[u.categoria].push(u.id);
        });
        for (const [cat, ids] of Object.entries(byCat)) {
          const { error: upErr } = await supabase.from('products').update({ categoria: cat }).in('id', ids);
          if (upErr) stats.errors++;
        }
      }

      setAutoCatResults(stats);
      if (!isDryRun) {
        await fetchData(true);
        await loadCategoryData();
      }
    } catch (err: any) {
      alert('Error en recategorización: ' + (err.message || String(err)));
    } finally {
      setIsProcessingAutoCat(false);
      setAutoCatProgress(null);
    }
  };

  // Load Company Settings
  useEffect(() => {
    const loadCompanySettings = async () => {
      const settings = await companySettingsService.get();
      setGeneralConfig(prev => ({
        ...prev,
        telefonoSoporte: settings.whatsapp,
        direccion: settings.direccion,
        telefono: settings.telefono,
        instagram: settings.instagram,
        facebook: settings.facebook,
      }));
    };
    loadCompanySettings();
  }, []);

  const saveBannersToSupabase = async (updatedBanners: AppBanner[]) => {
    try {
      const rows = updatedBanners.map((b, i) => ({
        id: b.id,
        titulo: b.titulo,
        subtitulo: b.subtitulo,
        imagen: b.imagen,
        link_destino: b.linkDestino,
        activo: b.activo,
        orden: i + 1,
      }));
      const { error } = await supabase
        .from('app_banners')
        .upsert(rows, { onConflict: 'id' });
      if (error) console.error('Error saving banners to Supabase:', error);
    } catch (e) {
      console.error('Error saving banners:', e);
    }
  };

  // Load banners on mount
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const { data, error } = await supabase
          .from('app_banners')
          .select('*')
          .order('orden', { ascending: true });
        if (!error && data && data.length > 0) {
          setBanners(data.map((b: any) => ({
            id: b.id,
            titulo: b.titulo,
            subtitulo: b.subtitulo || '',
            imagen: b.imagen || '',
            linkDestino: b.link_destino || '',
            activo: b.activo,
          })));
        }
      } catch (e) {
        console.error('Error loading banners:', e);
      }
    };
    loadBanners();
  }, []);

  const handleToggleBanner = (id: string) => {
    setBanners(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, activo: !b.activo } : b);
      saveBannersToSupabase(updated);
      return updated;
    });
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await companySettingsService.update({
      whatsapp: generalConfig.telefonoSoporte,
      direccion: generalConfig.direccion,
      telefono: generalConfig.telefono,
      instagram: generalConfig.instagram,
      facebook: generalConfig.facebook,
    });
    if (success) {
      alert('✅ Configuración general guardada con éxito.');
    } else {
      alert('❌ Error al guardar la configuración.');
    }
  };

  return (
    <div className="view-container">
      {/* Header with Title and Add Category Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '24px' }}>🏷️ Categorías & Configuración de App</h1>
          <p className="page-desc" style={{ margin: '4px 0 0 0' }}>
            Gestión de categorías, reglas de recategorización automática, banners y parámetros generales
          </p>
        </div>

        {activeTab === 'categorias' && (
          <button
            className="btn btn-primary"
            onClick={() => setIsAddCategoryModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: '700',
              borderRadius: '10px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
          >
            ➕ Agregar Categoría
          </button>
        )}

        {activeTab === 'localidades' && (
          <button
            className="btn btn-primary"
            onClick={() => setIsAddLocalidadModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: '700',
              borderRadius: '10px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
          >
            📍 Alta de Localidad
          </button>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('categorias')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            color: activeTab === 'categorias' ? '#2563EB' : '#64748b',
            borderBottom: activeTab === 'categorias' ? '3px solid #2563EB' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          📂 Categorías del Catálogo & App
        </button>
        <button
          onClick={() => setActiveTab('recategorizacion')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            color: activeTab === 'recategorizacion' ? '#2563EB' : '#64748b',
            borderBottom: activeTab === 'recategorizacion' ? '3px solid #2563EB' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          ⚡ Reglas & Recategorización Automática
        </button>
        <button
          onClick={() => setActiveTab('localidades')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            color: activeTab === 'localidades' ? '#2563EB' : '#64748b',
            borderBottom: activeTab === 'localidades' ? '3px solid #2563EB' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          📍 Localidades Habilitadas (Venta & Reparto)
        </button>
      </div>

      {/* TAB 1: CATEGORÍAS Y CONFIGURACIÓN DE APP */}
      {activeTab === 'categorias' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Lado Izquierdo: Lista de Categorías y Banners */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Tarjeta de Categorías Habilitadas */}
            <div className="card-wrapper" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>📂 Categorías Habilitadas en el Catálogo</h3>
                <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {categoriesConfig.length} Categorías
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '16px' }}>
                Podés renombrar categorías, subir sus imágenes de portada y ocultar secciones completas de la app móvil.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                {categoriesConfig.map(cat => {
                  const catKey = cat.catKey;
                  const currentImg = categoryBanners[catKey] || '';
                  return (
                    <div 
                      key={cat.id} 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '12px', 
                        background: cat.activa ? 'var(--accent-light)' : '#f8fafc', 
                        padding: '16px', 
                        borderRadius: '12px', 
                        border: '1px solid', 
                        borderColor: cat.activa ? 'var(--accent-color)' : '#e2e8f0' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>📦</span>
                            <input
                              type="text"
                              value={categoryNames[catKey] ?? cat.nombre}
                              onChange={e => {
                                const newVal = e.target.value;
                                setCategoryNames(prev => ({ ...prev, [catKey]: newVal }));
                              }}
                              onBlur={e => saveCategoryName(catKey, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                              style={{
                                fontSize: '15px',
                                fontWeight: '700',
                                color: cat.activa ? 'var(--primary-color)' : 'var(--text-secondary)',
                                border: 'none',
                                borderBottom: '1px dashed #cbd5e1',
                                background: 'transparent',
                                padding: '2px 4px',
                                width: '220px',
                                outline: 'none',
                              }}
                              placeholder="Nombre Categoría"
                            />
                            <span style={{ fontSize: '11px', color: '#94a3b8', background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                              key: {catKey}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '26px' }}>
                            {cat.itemsCount} productos asignados actualmente
                          </div>
                        </div>

                        <button 
                          type="button" 
                          className={`btn ${cat.activa ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 'bold' }}
                          onClick={() => handleToggleCategory(cat.id)}
                        >
                          {cat.activa ? '🟢 Habilitada' : '🔴 Oculta'}
                        </button>
                      </div>

                      {/* Subida / Edición de Banner de Categoría */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ position: 'relative', width: '80px', height: '50px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {currentImg ? (
                            <img src={currentImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '20px' }}>🖼️</span>
                          )}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <label style={{ display: 'inline-block', padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#475569' }}>
                              {uploadingCategory === catKey ? '⏳ Subiendo...' : '📁 Cargar Foto'}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                disabled={uploadingCategory === catKey}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCategoryUpload(catKey, file);
                                }}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => {
                                const url = prompt('Ingrese URL de la imagen:', currentImg);
                                if (url !== null) saveCategoryBanner(catKey, url);
                              }}
                              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', color: '#475569' }}
                            >
                              🔗 Enlace Externo
                            </button>
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Banner recomendado para portada: 800x250px</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Banners Promocionales de Inicio */}
            <div className="card-wrapper" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>🖼️ Banners Promocionales de Inicio</h3>
                <button
                  onClick={async () => {
                    await saveBannersToSupabase(banners);
                    alert('✅ Banners publicados en la app correctamente.');
                  }}
                  style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  🚀 Publicar en App
                </button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '16px' }}>
                Banners dinámicos de la pantalla principal móvil del cliente.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {banners.map(b => (
                  <div key={b.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <img src={b.imagen} alt="" style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '14px' }}>{b.titulo}</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{b.subtitulo}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={b.activo} 
                          onChange={() => handleToggleBanner(b.id)}
                        />
                        Activo
                      </label>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setEditingBanner(b)}
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lado Derecho: Formulario de Parámetros Generales y Canales de Soporte */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card-wrapper" style={{ padding: '24px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>📞 Canales de Soporte & App</h3>
              <form onSubmit={handleSaveGeneral}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Nombre Comercial</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={generalConfig.nombreApp}
                    onChange={e => setGeneralConfig({ ...generalConfig, nombreApp: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">WhatsApp de Soporte (sin "+")</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: 5493511234567"
                    value={generalConfig.telefonoSoporte}
                    onChange={e => setGeneralConfig({ ...generalConfig, telefonoSoporte: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Dirección Física</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Bv. San Martín 123"
                    value={generalConfig.direccion}
                    onChange={e => setGeneralConfig({ ...generalConfig, direccion: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Teléfono Fijo / Comercial</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={generalConfig.telefono}
                    onChange={e => setGeneralConfig({ ...generalConfig, telefono: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Instagram (sin @)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={generalConfig.instagram}
                    onChange={e => setGeneralConfig({ ...generalConfig, instagram: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Facebook</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={generalConfig.facebook}
                    onChange={e => setGeneralConfig({ ...generalConfig, facebook: e.target.value })}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '8px', padding: '10px', fontSize: '13px', fontWeight: 'bold' }}
                >
                  💾 Guardar Datos de Soporte
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGLAS Y RECATEGORIZACIÓN AUTOMÁTICA */}
      {activeTab === 'recategorizacion' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Columna 1: Editor de Reglas por Categoría */}
          <div className="card-wrapper" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', fontSize: '16px' }}>🎯 Reglas & Patrones por Categoría</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '16px' }}>
              Una categoría puede tener asociadas varias palabras clave o patrones de coincidencia (en nombre, código o descripción del artículo).
            </p>

            {/* Selector de Categoría a Editar */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Seleccionar Categoría a Configurar:
              </label>
              <select
                value={selectedRuleCategory}
                onChange={e => setSelectedRuleCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  background: '#f8fafc'
                }}
              >
                {categoriesConfig.map(c => (
                  <option key={c.catKey} value={c.catKey}>
                    📦 {categoryNames[c.catKey] || c.nombre} ({c.catKey}) — {(rulesMap[c.catKey] || []).length} patrones
                  </option>
                ))}
              </select>
            </div>

            {/* Formulario para Agregar Nuevo Patrón */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nuevo patrón (Ej: desinfectante, amoniaco, skimmer...)"
                value={newPatternInput}
                onChange={e => setNewPatternInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPattern(selectedRuleCategory, newPatternInput);
                  }
                }}
                style={{ flex: 1, fontSize: '13px' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAddPattern(selectedRuleCategory, newPatternInput)}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 'bold' }}
              >
                ➕ Agregar Patrón
              </button>
            </div>

            {/* Lista de Patrones Visuales (Badges) */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', minHeight: '180px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <span>Patrones Activos ({ (rulesMap[selectedRuleCategory] || []).length })</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Coincidencia parcial activada</span>
              </h4>

              {(!rulesMap[selectedRuleCategory] || rulesMap[selectedRuleCategory].length === 0) ? (
                <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '30px' }}>
                  No hay patrones configurados para esta categoría. Agregá una palabra clave arriba.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {rulesMap[selectedRuleCategory].map(pattern => (
                    <span
                      key={pattern}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#1e293b',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      {pattern}
                      <button
                        type="button"
                        onClick={() => handleRemovePattern(selectedRuleCategory, pattern)}
                        title="Eliminar regla"
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          padding: 0,
                          fontSize: '14px',
                          lineHeight: 1
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna 2: Ejecutor de Recategorización Automática */}
          <div className="card-wrapper" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', fontSize: '16px' }}>🤖 Motor de Recategorización Automática</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '16px' }}>
              Aplica las reglas y patrones configurados sobre el catálogo de productos para clasificarlos automáticamente.
            </p>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0369a1', marginBottom: '8px' }}>⚙️ Opciones de Ejecución</div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: '10px', color: '#1e293b' }}>
                <input 
                  type="checkbox" 
                  checked={onlySinCat} 
                  onChange={e => setOnlySinCat(e.target.checked)}
                />
                Solo productos sin categoría (o sin reclasificar)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}>
                <input 
                  type="checkbox" 
                  checked={isDryRun} 
                  onChange={e => setIsDryRun(e.target.checked)}
                />
                Modo Simulación (Dry-Run: probar sin alterar base de datos)
              </label>
            </div>

            {/* Progress Bar during execution */}
            {isProcessingAutoCat && autoCatProgress && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                  <span>Procesando catálogo...</span>
                  <span>{autoCatProgress.current} / {autoCatProgress.total}</span>
                </div>
                <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      background: '#2563EB', 
                      width: `${autoCatProgress.total ? (autoCatProgress.current / autoCatProgress.total) * 100 : 0}%`,
                      transition: 'width 0.2s'
                    }} 
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={isProcessingAutoCat}
              onClick={handleRunAutoRecategorization}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '700',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '20px'
              }}
            >
              {isProcessingAutoCat ? '⏳ Reclasificando Productos...' : '▶️ Ejecutar Recategorización Automática'}
            </button>

            {/* Results Output */}
            {autoCatResults && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '10px', flex: 1, overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>
                  ✅ Resumen de Resultados {isDryRun ? '(Modo Simulación)' : ''}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                  <div>Total Procesados: <strong>{autoCatResults.processed}</strong></div>
                  <div>Reclasificados: <strong style={{ color: '#16a34a' }}>{autoCatResults.updated}</strong></div>
                  <div>Sin cambios: <strong>{autoCatResults.unchanged}</strong></div>
                  <div>Errores: <strong>{autoCatResults.errors}</strong></div>
                </div>

                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                  Desglose por Categoría Reclasificada:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(autoCatResults.byCategory).map(([cat, n]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: '600' }}>📦 {categoryNames[cat] || cat}</span>
                      <span style={{ fontWeight: 'bold', color: '#2563EB' }}>{n} productos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOCALIDADES HABILITADAS PARA REPARTO Y VENTA */}
      {activeTab === 'localidades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📍 Zonas & Localidades Habilitadas</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Restricción geográfica para registro de clientes y pedidos con envío/reparto.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setIsAddLocalidadModalOpen(true)}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700', borderRadius: '10px' }}
              >
                ➕ Nueva Localidad
              </button>
            </div>

            {loadingLocalidades ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando localidades...</div>
            ) : localidadesList.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                No hay localidades registradas todavía. Podés dar de alta la primera usando el botón "Nueva Localidad".
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {localidadesList.map((loc) => (
                  <div
                    key={loc.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px',
                      background: loc.activa ? '#ffffff' : '#f8fafc',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📍 {loc.nombre}
                        </span>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          {loc.provincia} {loc.codigoPostal ? `• CP ${loc.codigoPostal}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteLocalidad(loc)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '15px' }}
                        title="Eliminar localidad"
                      >
                        🗑️
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: loc.activa ? '#15803d' : '#b91c1c' }}>
                        <span>🛒 Registro / Venta Habilitada:</span>
                        <input
                          type="checkbox"
                          checked={loc.activa}
                          onChange={() => handleToggleLocalidadActiva(loc)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                        />
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: loc.repartoHabilitado ? '#1d4ed8' : '#64748b' }}>
                        <span>🚚 Delivery / Reparto Activo:</span>
                        <input
                          type="checkbox"
                          checked={loc.repartoHabilitado}
                          onChange={() => handleToggleLocalidadReparto(loc)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                        />
                      </label>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>🏢 Sucursal Principal Asignada:</span>
                        <select
                          value={loc.branchId || ''}
                          onChange={e => handleUpdateLocalidadBranch(loc.id, e.target.value ? Number(e.target.value) : undefined)}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold', background: '#ffffff' }}
                        >
                          <option value="">(Sin asignar / Por Defecto)</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>🏢 {b.nombre} ({b.localidad || 'Deheza'})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVA LOCALIDAD */}
      {isAddLocalidadModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>📍 Alta de Nueva Localidad</h3>
            <form onSubmit={handleCreateLocalidad}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Nombre de Localidad / Ciudad *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: General Deheza, General Cabrera..."
                  value={newLocNombre} 
                  onChange={e => setNewLocNombre(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Provincia</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: Córdoba"
                  value={newLocProvincia} 
                  onChange={e => setNewLocProvincia(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Código Postal (Opcional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 5923"
                  value={newLocCP} 
                  onChange={e => setNewLocCP(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddLocalidadModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingLoc}
                  style={{ padding: '8px 20px', fontWeight: 'bold' }}
                >
                  {isSubmittingLoc ? 'Guardando...' : '💾 Guardar Localidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVA CATEGORÍA */}
      {isAddCategoryModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            animation: 'fadeScale 0.2s ease-out'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold' }}>➕ Crear Nueva Categoría</h3>
              <button
                onClick={() => setIsAddCategoryModalOpen(false)}
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategorySubmit} style={{ padding: '24px' }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>Nombre de la Categoría *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Ferretería Industrial, Accesorios de Limpieza"
                  value={newCatNombre}
                  onChange={e => {
                    setNewCatNombre(e.target.value);
                    if (!newCatKey) {
                      setNewCatKey(e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>Clave Única (catKey / Slug)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: ferreteria, accesorios"
                  value={newCatKey}
                  onChange={e => setNewCatKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                  Identificador técnico usado en productos y base de datos.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>URL de Imagen / Banner de Portada (Opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://images.unsplash.com/..."
                  value={newCatImagen}
                  onChange={e => setNewCatImagen(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>Patrones o Reglas Iniciales (Separados por coma)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: tornillo, tuerca, martillo, herramienta"
                  value={newCatPatrones}
                  onChange={e => setNewCatPatrones(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                  Palabras clave para asignar automáticamente productos a esta nueva categoría.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCat}
                  style={{ padding: '8px 20px', fontWeight: 'bold' }}
                >
                  {isSubmittingCat ? 'Guardando...' : '💾 Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR BANNER */}
      {editingBanner && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '24px'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>✏️ Editar Banner Promocional</h3>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Título</label>
              <input 
                type="text" className="form-input" 
                value={editingBanner.titulo} 
                onChange={e => setEditingBanner({ ...editingBanner, titulo: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Subtítulo</label>
              <input 
                type="text" className="form-input" 
                value={editingBanner.subtitulo} 
                onChange={e => setEditingBanner({ ...editingBanner, subtitulo: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">URL de Imagen</label>
              <input 
                type="text" className="form-input" 
                value={editingBanner.imagen} 
                onChange={e => setEditingBanner({ ...editingBanner, imagen: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingBanner(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                setBanners(prev => {
                  const updated = prev.map(b => b.id === editingBanner.id ? editingBanner : b);
                  saveBannersToSupabase(updated);
                  return updated;
                });
                setEditingBanner(null);
              }}>Guardar Banner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
