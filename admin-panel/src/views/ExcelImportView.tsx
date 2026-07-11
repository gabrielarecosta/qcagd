import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdminStore } from '../store/adminStore';
import { EXCEL_FORMAT_HELP } from '@shared/services/excelImportService';
import { validateExcelHeaders } from '@shared/utils/excelValidator';
import { validateRow, normalizeRow, rowToProduct } from '@shared/utils/productValidator';
import { Product } from '@shared/types/product';
import { ImportRowError } from '@shared/types/notification';

export function ExcelImportView() {
  const { 
    branches, 
    bulkReplaceCatalog, 
    bulkUpdateExistingCatalog, 
    bulkAddNewCatalog, 
    updateBranchStock 
  } = useAdminStore();

  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || 'branch-gd1');
  const [importMode, setImportMode] = useState<'replace' | 'update' | 'append'>('append');
  
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const [rowStocks, setRowStocks] = useState<Record<number, { stock: number; stockMinimo: number }>>({});
  const [importSuccess, setImportSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setFile(files[0]);
      setHeadersError(null);
      setErrors([]);
      setParsedProducts([]);
      setImportSuccess(false);
    }
  };

  const processFile = () => {
    if (!file) return;
    setParsing(true);
    setHeadersError(null);
    setErrors([]);
    setParsedProducts([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('No se pudieron leer los datos del archivo.');

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Obtener filas en formato JSON
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        
        if (rawRows.length === 0) {
          setHeadersError('El archivo seleccionado está vacío.');
          setParsing(false);
          return;
        }

        // Obtener headers reales del archivo
        const headers = Object.keys(rawRows[0]);
        const headerValidationError = validateExcelHeaders(headers);

        if (headerValidationError) {
          setHeadersError(headerValidationError.mensaje);
          setParsing(false);
          return;
        }

        // Procesar y validar cada fila
        const productsList: Product[] = [];
        const errorsList: ImportRowError[] = [];
        const stocksMap: Record<number, { stock: number; stockMinimo: number }> = {};

        rawRows.forEach((rawRow, idx) => {
          const rowNum = idx + 2; // Fila 1 es el header
          const normalized = normalizeRow(rawRow);
          
          // Validar
          const rowErrors = validateRow(normalized, rowNum);
          if (rowErrors.length > 0) {
            errorsList.push(...rowErrors);
          }

          // Mapear a modelo Product
          const product = rowToProduct(normalized, idx);
          productsList.push(product);

          // Extraer stock de la fila si existe
          const parsedStock = normalized.stock ? parseInt(normalized.stock) : 0;
          const parsedMin = normalized.stock_minimo ? parseInt(normalized.stock_minimo) : 5;
          stocksMap[idx] = { stock: parsedStock, stockMinimo: parsedMin };
        });

        if (errorsList.length > 0) {
          setErrors(errorsList);
        }

        setParsedProducts(productsList);
        setRowStocks(stocksMap);
      } catch (err) {
        setHeadersError(`Error al parsear el archivo: ${(err as Error).message}`);
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setHeadersError('Error al leer el archivo.');
      setParsing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (parsedProducts.length === 0) return;
    setParsing(true);

    try {
      if (importMode === 'replace') {
        await bulkReplaceCatalog(parsedProducts, selectedBranchId, rowStocks, file?.name || 'importacion.xlsx');
      } else if (importMode === 'update') {
        await bulkUpdateExistingCatalog(parsedProducts, selectedBranchId, rowStocks, file?.name || 'importacion.xlsx');
      } else {
        await bulkAddNewCatalog(parsedProducts, selectedBranchId, rowStocks, file?.name || 'importacion.xlsx');
      }

      setImportSuccess(true);
      setFile(null);
      setParsedProducts([]);
      setErrors([]);
    } catch (err) {
      alert(`Error al importar: ${(err as Error).message}`);
    } finally {
      setParsing(false);
    }
  };

  // Generar CSV de ejemplo para descargar
  const handleDownloadSample = () => {
    const headers = EXCEL_FORMAT_HELP.columnas.map(c => c.nombre).join(',');
    const exampleVal = EXCEL_FORMAT_HELP.columnas.map(c => {
      const val = (EXCEL_FORMAT_HELP.ejemplo as Record<string, string>)[c.nombre] || '';
      return val.includes(',') ? `"${val}"` : val;
    }).join(',');
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + exampleVal;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla_articulos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="view-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Carga de Artículos desde Excel</h1>
        <p className="page-desc">Importar, actualizar y abastecer el catálogo de productos de forma masiva</p>
      </div>

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Panel de Importación */}
        <div className="card-wrapper" style={{ padding: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Subir Archivo de Artículos</h2>
          
          {importSuccess && (
            <div className="badge badge-success" style={{ display: 'block', padding: '12px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
              🎉 ¡Catálogo importado con éxito! Los productos han sido sincronizados.
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">1. Seleccione la sucursal de destino para el stock</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-4px', marginBottom: '8px' }}>
              Las cantidades especificadas en el stock de la planilla se registrarán en esta sucursal.
            </p>
            <select 
              className="form-select"
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">2. Seleccione el método de importación</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="importMode" 
                  checked={importMode === 'append'} 
                  onChange={() => setImportMode('append')} 
                />
                <div>
                  <strong>Solo agregar nuevos:</strong> Agrega artículos nuevos del archivo. Si el código ya existe, lo ignora.
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="importMode" 
                  checked={importMode === 'update'} 
                  onChange={() => setImportMode('update')} 
                />
                <div>
                  <strong>Actualizar existentes:</strong> Modifica la información y el precio de los códigos que coincidan, conservando los demás.
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="importMode" 
                  checked={importMode === 'replace'} 
                  onChange={() => setImportMode('replace')} 
                />
                <div style={{ color: 'var(--error-color)' }}>
                  <strong>Reemplazar catálogo completo:</strong> Elimina todos los artículos actuales e inserta únicamente los del archivo. ¡Acción destructiva!
                </div>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">3. Seleccione el archivo (.xlsx, .xls o .csv)</label>
            <div style={{ border: '2px dashed var(--border-color)', padding: '30px', borderRadius: '8px', textAlign: 'center', background: '#f8fafc', marginTop: '6px' }}>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange} 
                style={{ cursor: 'pointer' }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-disabled)', marginTop: '8px' }}>
                Asegúrese de respetar los nombres exactos de las columnas indicadas en la guía.
              </p>
            </div>
          </div>

          {file && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={processFile} disabled={parsing}>
                {parsing ? 'Analizando archivo...' : '🔍 Validar Archivo'}
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Archivo cargado: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
              </span>
            </div>
          )}

          {/* Errores del Header */}
          {headersError && (
            <div className="badge badge-error" style={{ display: 'block', padding: '12px', marginTop: '20px', fontSize: '13px' }}>
              ❌ {headersError}
            </div>
          )}

          {/* Errores de Filas / Advertencias */}
          {errors.length > 0 && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--error-light)', borderLeft: '4px solid var(--error-color)', borderRadius: '6px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--error-color)' }}>
                Se encontraron {errors.length} advertencias en las filas del archivo:
              </h3>
              <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '12px' }}>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {errors.map((err, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>
                      Fila {err.fila}, Columna <strong>{err.columna}</strong>: {err.motivo}
                    </li>
                  ))}
                </ul>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', marginBottom: 0 }}>
                💡 Podrá continuar con la importación, pero las celdas con errores se guardarán con valores por defecto.
              </p>
            </div>
          )}

          {/* Previsualización del Importador */}
          {parsedProducts.length > 0 && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Previsualización de Productos ({parsedProducts.length} detectados)</h3>
              
              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px' }}>
                <table className="admin-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Presentación</th>
                      <th>Precio</th>
                      <th>Stock Inicial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedProducts.slice(0, 5).map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>{p.codigo}</td>
                        <td>{p.nombre}</td>
                        <td>{p.categoria}</td>
                        <td>{p.presentacion}</td>
                        <td>${p.precio}</td>
                        <td>{rowStocks[idx]?.stock ?? 0} {p.unidad}</td>
                      </tr>
                    ))}
                    {parsedProducts.length > 5 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                          ... y {parsedProducts.length - 5} productos más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => { setParsedProducts([]); setFile(null); }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleExecuteImport} style={{ background: '#10b981' }}>
                  📥 Confirmar Importación Masiva
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Formato de Ayuda */}
        <div className="card-wrapper" style={{ padding: '20px', alignSelf: 'start' }}>
          <h3 style={{ fontSize: '15px', marginTop: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ℹ️ Guía de Formato
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            El archivo debe contener las siguientes columnas obligatorias:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
            {EXCEL_FORMAT_HELP.columnas.map((col, idx) => (
              <div key={idx} style={{ paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{col.nombre}</span> 
                {col.obligatorio === 'Sí' && <span style={{ color: 'var(--error-color)', fontSize: '10px', marginLeft: '4px' }}>(Obligatorio)</span>}
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                  Tipo: {col.tipo} — {col.descripcion}
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={handleDownloadSample} style={{ width: '100%', padding: '8px' }}>
            📥 Descargar CSV de Plantilla
          </button>
        </div>
      </div>
    </div>
  );
}
