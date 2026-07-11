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

export function ProductsView() {
  const { 
    products, 
    stocks, 
    branches, 
    activeBranchId, 
    updateProduct, 
    createProduct, 
    updateBranchStock 
  } = useAdminStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
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
  });

  const [formStocks, setFormStocks] = useState<Record<string, { stock: number; stockMinimo: number }>>({});

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

  // Filtrado y búsqueda de productos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const query = search.toLowerCase();
      const matchesSearch = 
        p.nombre.toLowerCase().includes(query) ||
        p.codigo.toLowerCase().includes(query) ||
        (p.presentacion || '').toLowerCase().includes(query);

      const matchesCategory = 
        selectedCategory === 'all' || p.categoria === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormProduct({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      presentacion: p.presentacion || '',
      precio: p.precio,
      unidad: p.unidad,
      destacado: p.destacado || false,
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

    // Actualizar producto base
    updateProduct(editingProduct.id, {
      codigo: formProduct.codigo,
      nombre: formProduct.nombre,
      categoria: formProduct.categoria,
      presentacion: formProduct.presentacion,
      precio: formProduct.precio,
      unidad: formProduct.unidad,
      destacado: formProduct.destacado,
      activo: true,
    });

    // Actualizar stock por sucursal
    Object.entries(formStocks).forEach(([bId, sVal]) => {
      updateBranchStock(editingProduct.id, bId, sVal.stock, sVal.stockMinimo);
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
    const userEmail = useAdminStore.getState().currentUser?.email || 'admin@quimicadeheza.com';
    
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

  return (
    <div className="view-container">
      <div className="view-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Gestión de Catálogo</h1>
          <p className="page-desc">Administrar los más de 6000 productos y niveles de stock por sucursal</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportProducts}>
            📤 Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            ➕ Nuevo Producto
          </button>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtro */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por código, nombre o presentación..." 
              value={search} 
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div style={{ width: '200px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Encontrados: <strong>{filteredProducts.length}</strong> artículos
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="card-wrapper">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Presentación</th>
                <th>Precio</th>
                <th>Stock Activo</th>
                <th>Destacado</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map(p => {
                const stockInfo = getProductStockInfo(p.id, activeBranchId);
                return (
                  <tr key={p.id}>
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
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-header">
                <h2 className="card-title">Editar Producto: {editingProduct.codigo}</h2>
                <button type="button" className="btn-close" onClick={() => setEditingProduct(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                
                <h3 style={{ fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px' }}>Información Básica</h3>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Código Único</label>
                    <input 
                      type="text" 
                      className="form-input" 
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
                    <label className="form-label">Presentación (Ej: 5 Litros, 10 Kg)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formProduct.presentacion}
                      onChange={e => setFormProduct({ ...formProduct, presentacion: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad de Medida</label>
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
                      value={formProduct.precio}
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
                      Destacar producto (se verá al inicio de la app)
                    </label>
                  </div>
                </div>

                <h3 style={{ fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '6px', marginBottom: '12px', marginTop: '24px' }}>Stock por Sucursales</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {branches.map(b => {
                    const currentBranchStock = formStocks[b.id] || { stock: 0, stockMinimo: 5 };
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', flex: 1 }}>{b.nombre}</div>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <div style={{ width: '120px' }}>
                            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Stock Actual</label>
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
                          <div style={{ width: '120px' }}>
                            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Alerta Mínimo</label>
                            <input 
                              type="number" 
                              className="form-input"
                              style={{ padding: '4px 8px' }}
                              value={currentBranchStock.stockMinimo}
                              onChange={e => setFormStocks({
                                ...formStocks,
                                [b.id]: { ...currentBranchStock, stockMinimo: parseInt(e.target.value) || 0 }
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
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProduct(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Producto */}
      {isCreating && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
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
