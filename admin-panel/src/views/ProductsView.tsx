import React, { useState, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { Product, ProductCategory } from '@shared/types/product';
import { formatPrice } from '@shared/utils/formatCurrency';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';

interface CategoryItem {
  value: ProductCategory;
  label: string;
}

export function ProductsView({ 
  initialFilter = 'all', 
  onResetFilter 
}: { 
  initialFilter?: 'all' | 'no-photo'; 
  onResetFilter?: () => void;
}) {
  const { 
    products, 
    stocks, 
    branches, 
    activeBranchId, 
    updateProduct, 
    createProduct, 
    updateBranchStock,
    createSuperOffer
  } = useAdminStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'no-photo'>(initialFilter);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'with-stock' | 'critico' | 'no-stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'price' | 'stock' | 'code'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    setPhotoFilter(initialFilter);
  }, [initialFilter]);

  const handleSort = (column: 'name' | 'category' | 'price' | 'stock' | 'code') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State for Editing/Creating
  const [formProduct, setFormProduct] = useState({
    codigo: '',
    nombre: '',
    categoria: 'limpieza' as ProductCategory,
    presentacion: '',
    precio: 0,
    unidad: 'U',
    destacado: false,
    imagen: '',
    descripcion: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('upload');

  const [formStocks, setFormStocks] = useState<Record<string, { stock: number; stockMinimo: number }>>({});
  const [stockReason, setStockReason] = useState('Ajuste de emergencia');

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [offerForm, setOfferForm] = useState({
    nombre: '',
    descripcion: '',
    precioOferta: 0,
  });
  const [offerItems, setOfferItems] = useState<{ productId: string; nombre: string; precio: number; cantidad: number; unidad: string }[]>([]);

  const itemsPerPage = 30;

  const categories: CategoryItem[] = [
    { value: 'limpieza', label: 'Limpieza' },
    { value: 'quimicos', label: 'Químicos' },
    { value: 'perfumeria', label: 'Perfumería' },
    { value: 'descartables', label: 'Descartables' },
    { value: 'piscina', label: 'Piscina' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'hogar', label: 'Hogar' },
    { value: 'institucional', label: 'Institucional' },
  ];

  // Obtener stock para una sucursal específica o resumen
  const getProductStockInfo = (productId: string, branchId: string) => {
    if (branchId === 'all') {
      const productStocks = stocks.filter(s => s.productId === productId);
      const totalStock = productStocks.reduce((sum, s) => sum + s.stock, 0);
      const isLowStock = productStocks.some(s => s.stock <= s.stockMinimo);
      return { stock: totalStock, isLowStock, details: productStocks };
    } else {
      const itemStock = stocks.find(s => s.productId === productId && s.branchId === branchId);
      const stockVal = itemStock ? itemStock.stock : 0;
      const minVal = itemStock ? itemStock.stockMinimo : 0;
      return { 
        stock: stockVal, 
        isLowStock: stockVal <= minVal, 
        details: itemStock ? [itemStock] : [] 
      };
    }
  };

  // Filtrado, búsqueda y ordenación de productos
  const filteredProducts = useMemo(() => {
    const list = products.filter(p => {
      const query = search.toLowerCase();
      const matchesSearch = 
        p.nombre.toLowerCase().includes(query) ||
        p.codigo.toLowerCase().includes(query) ||
        (p.presentacion || '').toLowerCase().includes(query);

      const matchesCategory = 
        selectedCategory === 'all' || p.categoria === selectedCategory;

      const matchesPhoto = 
        photoFilter === 'all' || !p.imagen || p.imagen.trim() === '';

      const matchesActiveStatus =
        activeStatusFilter === 'all' ? true :
        activeStatusFilter === 'active' ? (p.activo !== false) :
        (p.activo === false);

      const stockInfo = getProductStockInfo(p.id, activeBranchId);
      const matchesStock =
        stockFilter === 'all' ? true :
        stockFilter === 'with-stock' ? (stockInfo.stock > 0 && !stockInfo.isLowStock) :
        stockFilter === 'critico' ? stockInfo.isLowStock :
        (stockInfo.stock <= 0);

      return matchesSearch && matchesCategory && matchesPhoto && matchesActiveStatus && matchesStock;
    });

    // Ordenamiento
    return list.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = a.nombre.localeCompare(b.nombre);
      } else if (sortBy === 'category') {
        comp = a.categoria.localeCompare(b.categoria);
      } else if (sortBy === 'price') {
        comp = (a.precio || 0) - (b.precio || 0);
      } else if (sortBy === 'stock') {
        const stockA = getProductStockInfo(a.id, activeBranchId).stock;
        const stockB = getProductStockInfo(b.id, activeBranchId).stock;
        comp = stockA - stockB;
      } else if (sortBy === 'code') {
        comp = a.codigo.localeCompare(b.codigo);
      }

      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [products, search, selectedCategory, photoFilter, activeStatusFilter, stockFilter, sortBy, sortOrder, activeBranchId, stocks]);

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setStockReason('Ajuste de emergencia');
    setFormProduct({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      presentacion: p.presentacion || '',
      precio: p.precio,
      unidad: p.unidad,
      destacado: p.destacado || false,
      imagen: p.imagen || '',
      descripcion: p.descripcion || '',
    });

    // Cargar stocks actuales
    const stockMap: Record<string, { stock: number; stockMinimo: number }> = {};
    branches.forEach(b => {
      const match = stocks.find(s => s.productId === p.id && s.branchId === b.id);
      stockMap[b.id] = {
        stock: match ? match.stock : 0,
        stockMinimo: match ? match.stockMinimo : 5,
      };
    });
    setFormStocks(stockMap);
  };

  const handleOpenCreate = () => {
    setIsCreating(true);
    setFormProduct({
      codigo: '',
      nombre: '',
      categoria: 'limpieza',
      presentacion: '',
      precio: 0,
      unidad: 'U',
      destacado: false,
      imagen: '',
      descripcion: '',
    });


    const stockMap: Record<string, { stock: number; stockMinimo: number }> = {};
    branches.forEach(b => {
      stockMap[b.id] = { stock: 10, stockMinimo: 5 };
    });
    setFormStocks(stockMap);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    updateProduct(editingProduct.id, {
      codigo: formProduct.codigo,
      nombre: formProduct.nombre,
      categoria: formProduct.categoria,
      presentacion: formProduct.presentacion,
      precio: formProduct.precio,
      unidad: formProduct.unidad,
      destacado: formProduct.destacado,
      imagen: formProduct.imagen || undefined,
      descripcion: formProduct.descripcion || undefined,
      activo: true,
    });

    setEditingProduct(null);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Preparar iniciales para la acción
    const initialStocks: Record<string, number> = {};
    Object.entries(formStocks).forEach(([bId, sVal]) => {
      initialStocks[bId] = sVal.stock;
    });

    createProduct({
      codigo: formProduct.codigo,
      nombre: formProduct.nombre,
      categoria: formProduct.categoria,
      presentacion: formProduct.presentacion,
      precio: formProduct.precio,
      unidad: formProduct.unidad,
      destacado: formProduct.destacado,
      imagen: formProduct.imagen || undefined,
      activo: true,
    }, initialStocks);

    setIsCreating(false);
  };

  const handleExportProducts = () => {
    const dataToExport = filteredProducts.map(p => {
      const stockInfo = getProductStockInfo(p.id, activeBranchId);
      return {
        Código: p.codigo,
        Nombre: p.nombre,
        Categoría: p.categoria,
        Presentación: p.presentacion || '',
        Unidad: p.unidad,
        Precio: p.precio,
        PrecioMayorista: p.precioMayorista || '',
        Stock: stockInfo.stock,
      };
    });

    const fileName = `productos_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || '';
    
    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'productos',
        filtros: { branchId: activeBranchId, category: selectedCategory, search },
        cantidad_registros: dataToExport.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
    XLSX.writeFile(workbook, fileName);
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    const paginatedIds = paginatedProducts.map(p => p.id);
    const allSelected = paginatedIds.every(id => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const handleOpenCreateOffer = () => {
    const selectedProds = products.filter(p => selectedProductIds.includes(p.id));
    const originalPrice = selectedProds.reduce((sum, p) => sum + p.precio, 0);
    
    setOfferForm({
      nombre: '',
      descripcion: '',
      precioOferta: Math.round(originalPrice * 0.8),
    });
    
    setOfferItems(selectedProds.map(p => {
      let qty = 1;
      const numMatch = (p.presentacion || '').match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        qty = parseFloat(numMatch[1]);
      }
      return {
        productId: p.id,
        nombre: p.nombre,
        precio: p.precio,
        cantidad: qty,
        unidad: p.unidad || 'U'
      };
    }));
    
    setIsCreatingOffer(true);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const originalPrice = offerItems.reduce((sum, item) => sum + item.precio, 0);
      await createSuperOffer({
        nombre: offerForm.nombre,
        descripcion: offerForm.descripcion,
        precioOriginal: originalPrice,
        precioOferta: offerForm.precioOferta,
        activo: true
      }, offerItems);
      
      setIsCreatingOffer(false);
      setSelectedProductIds([]);
      alert('Súper Oferta Creada Exitosamente!');
    } catch (err: any) {
      alert('Error al crear la oferta: ' + (err.message || String(err)));
    }
  };

  return (
    <div className="view-container">
      <div className="view-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Gestión de Catálogo</h1>
          <p className="page-desc">Administrar los más de 6000 productos y niveles de stock por sucursal</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedProductIds.length > 0 && (
            <button className="btn btn-warning" onClick={handleOpenCreateOffer} style={{ background: '#fbbf24', color: '#0f172a', fontWeight: '700', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎁 Crear Oferta ({selectedProductIds.length})
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleExportProducts}>
            📤 Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            ➕ Nuevo Producto
          </button>
        </div>
      </div>

      {/* Controles de Búsqueda, Filtros y Ordenamiento */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Búsqueda */}
          <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="🔍 Buscar por código, nombre..." 
              value={search} 
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Filtro Categoría */}
          <div style={{ width: '160px' }}>
            <select 
              className="form-select"
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Filtro Activo (Sí / No) */}
          <div style={{ width: '140px' }}>
            <select 
              className="form-select"
              value={activeStatusFilter}
              onChange={e => {
                setActiveStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                setCurrentPage(1);
              }}
            >
              <option value="all">Estado: Todos</option>
              <option value="active">Activos (Sí)</option>
              <option value="inactive">Inactivos (No)</option>
            </select>
          </div>

          {/* Filtro Stock Activo (Sí, No, Crítico) */}
          <div style={{ width: '160px' }}>
            <select 
              className="form-select"
              value={stockFilter}
              style={{ borderColor: stockFilter === 'critico' ? '#ef4444' : stockFilter === 'no-stock' ? '#f59e0b' : 'var(--border-color)', fontWeight: stockFilter !== 'all' ? 'bold' : 'normal' }}
              onChange={e => {
                setStockFilter(e.target.value as 'all' | 'with-stock' | 'critico' | 'no-stock');
                setCurrentPage(1);
              }}
            >
              <option value="all">Stock: Todos</option>
              <option value="with-stock">Con Stock (Sí)</option>
              <option value="critico">⚠️ Stock Crítico</option>
              <option value="no-stock">🚫 Sin Stock (No)</option>
            </select>
          </div>

          {/* Ordenar Por */}
          <div style={{ width: '170px' }}>
            <select 
              className="form-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={e => {
                const parts = e.target.value.split('-');
                setSortBy(parts[0] as any);
                setSortOrder(parts[1] as any);
                setCurrentPage(1);
              }}
            >
              <option value="name-asc">Nombre (A-Z)</option>
              <option value="name-desc">Nombre (Z-A)</option>
              <option value="category-asc">Categoría</option>
              <option value="price-asc">Precio (Menor a Mayor)</option>
              <option value="price-desc">Precio (Mayor a Menor)</option>
              <option value="stock-asc">Stock (Menor a Mayor)</option>
              <option value="stock-desc">Stock (Mayor a Menor)</option>
              <option value="code-asc">Código</option>
            </select>
          </div>

          {/* Filtro Fotos */}
          <div style={{ width: '150px' }}>
            <select 
              className="form-select"
              value={photoFilter}
              style={{ borderColor: photoFilter === 'no-photo' ? '#ec4899' : 'var(--border-color)', fontWeight: photoFilter === 'no-photo' ? 'bold' : 'normal' }}
              onChange={e => {
                const val = e.target.value as 'all' | 'no-photo';
                setPhotoFilter(val);
                setCurrentPage(1);
                if (val === 'all' && onResetFilter) {
                  onResetFilter();
                }
              }}
            >
              <option value="all">Fotos: Todos</option>
              <option value="no-photo">⚠️ Sin foto</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginLeft: 'auto' }}>
            Encontrados: <strong style={{ marginLeft: '4px', color: 'var(--text-primary)' }}>{filteredProducts.length}</strong> artículos
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="card-wrapper">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    onChange={toggleSelectAll} 
                    checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.includes(p.id))} 
                  />
                </th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => handleSort('code')}>
                  Código {sortBy === 'code' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  Nombre {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>
                  Categoría {sortBy === 'category' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Presentación</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
                  Precio {sortBy === 'price' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('stock')}>
                  Stock Activo {sortBy === 'stock' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Destacado</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map(p => {
                const stockInfo = getProductStockInfo(p.id, activeBranchId);
                return (
                  <tr key={p.id}>
                    <td style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedProductIds.includes(p.id)} 
                        onChange={() => toggleSelectProduct(p.id)} 
                      />
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{p.codigo}</td>
                    <td style={{ fontWeight: '500' }}>{p.nombre}</td>
                    <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{p.categoria}</span></td>
                    <td>{p.presentacion || '-'}</td>
                    <td style={{ fontWeight: '600' }}>{formatPrice(p.precio)}</td>
                    <td>
                      <span className={`badge ${stockInfo.isLowStock ? 'badge-error' : 'badge-success'}`}>
                        {stockInfo.stock} {p.unidad}
                      </span>
                      {stockInfo.isLowStock && (
                        <div style={{ fontSize: '11px', color: 'var(--error-color)', marginTop: '2px' }}>
                          ⚠️ Stock Crítico
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '16px' }}>{p.destacado ? '⭐ Sí' : '❌'}</span>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-secondary" onClick={() => handleOpenEdit(p)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                        ✏️ Editar / Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    Todavía no hay productos cargados. ¡Importá un archivo Excel para comenzar!
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    No se encontraron productos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Página {currentPage} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{ padding: '6px 12px' }}
              >
                ◀️ Anterior
              </button>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{ padding: '6px 12px' }}
              >
                Siguiente ▶️
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Editar Producto / Stock */}
      {editingProduct && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal-content" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '700px', display: 'flex', flexDirection: 'column', zIndex: 10000, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', color: '#fff' }}>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title" style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>Editar Producto: {editingProduct.codigo}</h2>
                <button type="button" className="btn-close" style={{ color: '#94a3b8', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }} onClick={() => setEditingProduct(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#38bdf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '12px' }}>Información Básica</h3>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Código Único</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#888', borderRadius: '6px', width: '100%', padding: '8px 12px', cursor: 'not-allowed' }}
                      value={formProduct.codigo}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Nombre Comercial</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#888', borderRadius: '6px', width: '100%', padding: '8px 12px', cursor: 'not-allowed' }}
                      value={formProduct.nombre}
                      disabled
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#fbbf24', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: '750' }}>Categoría (Editable)</label>
                    <select 
                      className="form-select"
                      style={{ background: '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '6px', width: '100%', padding: '8px 12px', cursor: 'pointer' }}
                      value={formProduct.categoria}
                      onChange={e => setFormProduct({ ...formProduct, categoria: e.target.value as ProductCategory })}
                    >
                      {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Presentación</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#888', borderRadius: '6px', width: '100%', padding: '8px 12px', cursor: 'not-allowed' }}
                      value={formProduct.presentacion}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Unidad de Medida</label>
                    <select 
                      className="form-select"
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#888', borderRadius: '6px', width: '100%', padding: '8px 12px', cursor: 'not-allowed' }}
                      value={formProduct.unidad}
                      disabled
                    >
                      <option value="U">Unidades (U)</option>
                      <option value="L">Litros (L)</option>
                      <option value="Kg">Kilogramos (Kg)</option>
                      <option value="Mts">Metros (Mts)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Precio ($ ARS)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#888', borderRadius: '6px', width: '100%', padding: '8px 12px', cursor: 'not-allowed' }}
                      value={formProduct.precio}
                      disabled
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '13px', color: '#e2e8f0' }}>
                      <input 
                        type="checkbox" 
                        checked={formProduct.destacado} 
                        onChange={e => setFormProduct({ ...formProduct, destacado: e.target.checked })}
                      />
                      Destacar producto (inicio de app)
                    </label>
                  </div>
                </div>

                {/* Product Description Input */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ color: '#fbbf24', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: '750' }}>Descripción del Producto (Editable)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={{ background: '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '6px', width: '100%', padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder="Escribí una descripción detallada, instrucciones de uso o detalles del producto..."
                    value={formProduct.descripcion}
                    onChange={e => setFormProduct({ ...formProduct, descripcion: e.target.value })}
                  />
                </div>

                {/* Dual Image Uploader */}
                <div className="form-group" style={{ marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <label className="form-label" style={{ color: '#fbbf24', fontSize: '13px', fontWeight: '700', marginBottom: '8px', display: 'block' }}>📸 Imagen del Producto</label>
                  
                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '0', marginBottom: '12px', border: '1px solid #334155', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setImageTab('upload')}
                      style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '11px', background: imageTab === 'upload' ? '#fbbf24' : '#1e293b', color: imageTab === 'upload' ? '#0f172a' : '#94a3b8', transition: 'all 0.15s' }}
                    >
                      📁 Subir Archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageTab('url')}
                      style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '11px', background: imageTab === 'url' ? '#fbbf24' : '#1e293b', color: imageTab === 'url' ? '#0f172a' : '#94a3b8', borderLeft: '1px solid #334155', transition: 'all 0.15s' }}
                    >
                      🔗 URL Externa
                    </button>
                  </div>

                  {/* Upload via Storage */}
                  {imageTab === 'upload' && (
                    <label
                      htmlFor="prod-image-file"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        border: '2px dashed #475569', borderRadius: '8px', padding: '16px',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        background: '#0f172a', transition: 'border-color 0.15s',
                        gap: '6px', minHeight: '80px', color: '#94a3b8', fontSize: '12px'
                      }}
                    >
                      <input
                        id="prod-image-file"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={isUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !editingProduct) return;
                          setIsUploading(true);
                          try {
                            const ext = file.name.split('.').pop();
                            const path = `products/${editingProduct.id}_${Date.now()}.${ext}`;
                            
                            let { error: upErr } = await supabase.storage
                              .from('app-assets')
                              .upload(path, file, { upsert: true, contentType: file.type });

                            if (upErr && (upErr.message?.toLowerCase().includes('bucket not found') || (upErr as any).statusCode === '404')) {
                              // Intentar crear el bucket si no existe
                              try {
                                await supabase.storage.createBucket('app-assets', { public: true });
                                const retryRes = await supabase.storage
                                  .from('app-assets')
                                  .upload(path, file, { upsert: true, contentType: file.type });
                                upErr = retryRes.error;
                              } catch (_) {}
                            }

                            if (upErr) {
                              if (upErr.message?.toLowerCase().includes('bucket not found')) {
                                throw new Error('El bucket "app-assets" no existe en Supabase Storage. Ejecute la migración SQL 10 en su panel de Supabase.');
                              }
                              throw upErr;
                            }

                            const { data: urlData } = supabase.storage
                              .from('app-assets')
                              .getPublicUrl(path);

                            setFormProduct(prev => ({ ...prev, imagen: urlData.publicUrl }));
                          } catch (err: any) {
                            alert('Error al subir imagen: ' + (err.message || String(err)));
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                      />
                      {isUploading ? (
                        <span>⏳ Subiendo imagen a Supabase...</span>
                      ) : (
                        <>
                          <span>🖼️ Arrastrá o hacé clic para elegir foto</span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Recomendado: 400x400px (cuadrado)</span>
                        </>
                      )}
                    </label>
                  )}

                  {/* URL Input */}
                  {imageTab === 'url' && (
                    <input
                      type="text"
                      className="form-input"
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', width: '100%', padding: '8px 12px' }}
                      placeholder="https://example.com/foto.jpg"
                      value={formProduct.imagen}
                      onChange={e => setFormProduct({ ...formProduct, imagen: e.target.value })}
                    />
                  )}

                  {/* Live preview */}
                  {formProduct.imagen && (
                    <div style={{ marginTop: '12px', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', position: 'relative', height: '140px' }}>
                      <img src={formProduct.imagen} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0f172a' }} />
                      <button
                        type="button"
                        onClick={() => setFormProduct({ ...formProduct, imagen: '' })}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Información sobre Sincronización de Stock */}
                <div style={{ 
                  marginTop: '24px', 
                  padding: '16px', 
                  background: 'rgba(245, 158, 11, 0.03)', 
                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                  borderRadius: '12px',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Sincronización Obligatoria de Stock
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
                    El stock de los productos no puede ser editado de forma manual desde la gestión del catálogo. El stock debe actualizarse obligatoriamente importando la planilla Excel correspondiente desde la sección de <strong>"Importar Excel"</strong> para reflejar la base de datos original del sistema y mantener consistencia.
                  </p>
                </div>

              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setEditingProduct(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Súper Oferta Combo */}
      {isCreatingOffer && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal-content" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', width: '95%', maxWidth: '650px', display: 'flex', flexDirection: 'column', zIndex: 10000, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', color: '#fff' }}>
            <form onSubmit={handleSaveOffer}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title" style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>🚨 Crear Súper Oferta Combo</h2>
                <button type="button" className="btn-close" style={{ color: '#94a3b8', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }} onClick={() => setIsCreatingOffer(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Nombre de la Oferta / Combo</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', width: '100%', padding: '8px 12px' }}
                    value={offerForm.nombre}
                    onChange={e => setOfferForm({ ...offerForm, nombre: e.target.value })}
                    placeholder="Ej: Combo Limpieza Total Deheza"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Descripción Comercial / Llamado</label>
                  <textarea 
                    className="form-input" 
                    style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', width: '100%', padding: '8px 12px', height: '60px', resize: 'none' }}
                    value={offerForm.descripcion}
                    onChange={e => setOfferForm({ ...offerForm, descripcion: e.target.value })}
                    placeholder="Ej: Súper promo ahorro! Llevate todo por tiempo limitado."
                  />
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Precio Original (Suma Real)</label>
                    <div style={{ padding: '8px 12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', color: '#a3a3a3', borderRadius: '6px', fontWeight: 'bold' }}>
                      {formatPrice(offerItems.reduce((sum, item) => sum + item.precio, 0))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>SUPER OFERTA ($ Precio Promo)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ background: '#0f172a', border: '1px solid #fbbf24', color: '#fbbf24', borderRadius: '6px', width: '100%', padding: '8px 12px', fontWeight: 'bold', fontSize: '15px' }}
                      value={offerForm.precioOferta}
                      onChange={e => setOfferForm({ ...offerForm, precioOferta: parseFloat(e.target.value) || 0 })}
                      required
                      min="0"
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#38bdf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '12px', marginTop: '20px' }}>Configuración de Artículos Incluidos</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {offerItems.map((item, idx) => (
                    <div key={item.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{item.nombre}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Precio original: {formatPrice(item.precio)}</div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ width: '80px' }}>
                          <label style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Cantidad</label>
                          <input 
                            type="number"
                            className="form-input"
                            style={{ padding: '4px 8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', width: '100%' }}
                            value={item.cantidad}
                            step="0.01"
                            onChange={e => {
                              const next = [...offerItems];
                              next[idx].cantidad = parseFloat(e.target.value) || 0;
                              setOfferItems(next);
                            }}
                          />
                        </div>
                        <div style={{ width: '90px' }}>
                          <label style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Unidad</label>
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', width: '100%', height: '28px', fontSize: '11px' }}
                            value={item.unidad}
                            onChange={e => {
                              const next = [...offerItems];
                              next[idx].unidad = e.target.value;
                              setOfferItems(next);
                            }}
                          >
                            <option value="U">Unidades (U)</option>
                            <option value="L">Litros (L)</option>
                            <option value="Kg">Kilogramos (Kg)</option>
                            <option value="Mts">Metros (Mts)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setIsCreatingOffer(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#fbbf24', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Crear Súper Oferta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Producto */}
      {isCreating && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal-content" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '700px', display: 'flex', flexDirection: 'column', zIndex: 10000, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <form onSubmit={handleSaveCreate}>
              <div className="modal-header">
                <h2 className="card-title">Crear Nuevo Producto</h2>
                <button type="button" className="btn-close" onClick={() => setIsCreating(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                
                <h3 style={{ fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px' }}>Información Básica</h3>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Código Único</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: DET-5L"
                      value={formProduct.codigo}
                      onChange={e => setFormProduct({ ...formProduct, codigo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nombre Comercial</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Detergente Concentrado Premium"
                      value={formProduct.nombre}
                      onChange={e => setFormProduct({ ...formProduct, nombre: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select 
                      className="form-select"
                      value={formProduct.categoria}
                      onChange={e => setFormProduct({ ...formProduct, categoria: e.target.value as ProductCategory })}
                    >
                      {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Presentación (Ej: 5 Litros)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Bidón 5L"
                      value={formProduct.presentacion}
                      onChange={e => setFormProduct({ ...formProduct, presentacion: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad</label>
                    <select 
                      className="form-select"
                      value={formProduct.unidad}
                      onChange={e => setFormProduct({ ...formProduct, unidad: e.target.value })}
                    >
                      <option value="U">Unidades (U)</option>
                      <option value="L">Litros (L)</option>
                      <option value="Kg">Kilogramos (Kg)</option>
                      <option value="Mts">Metros (Mts)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Precio ($ ARS)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formProduct.precio || ''}
                      onChange={e => setFormProduct({ ...formProduct, precio: parseFloat(e.target.value) || 0 })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' }}>
                      <input 
                        type="checkbox" 
                        checked={formProduct.destacado} 
                        onChange={e => setFormProduct({ ...formProduct, destacado: e.target.checked })}
                      />
                      Destacar producto
                    </label>
                  </div>
                </div>

                <h3 style={{ fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px', marginTop: '24px' }}>Stock Inicial por Sucursales</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {branches.map(b => {
                    const currentBranchStock = formStocks[b.id] || { stock: 10, stockMinimo: 5 };
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', flex: 1 }}>{b.nombre}</div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <div style={{ width: '120px' }}>
                            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Stock Inicial</label>
                            <input 
                              type="number" 
                              className="form-input"
                              style={{ padding: '4px 8px' }}
                              value={currentBranchStock.stock}
                              onChange={e => setFormStocks({
                                ...formStocks,
                                [b.id]: { ...currentBranchStock, stock: parseInt(e.target.value) || 0 }
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
