import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAdminStore } from '../store/adminStore';
import { validateExcelHeaders } from '@shared/utils/excelValidator';
import { analyzeImportRows, StagedRow } from '@shared/utils/conflictDetector';
import { formatPrice } from '@shared/utils/formatCurrency';

type Step = 'upload' | 'preview' | 'processing' | 'summary';

async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ExcelImportView() {
  const { 
    branches, 
    products,
    stocks,
    checkFileHashExists,
    createStagingImport,
    insertStagingRows,
    confirmImport
  } = useAdminStore();

  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || 'branch-gd1');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  
  // Staging states
  const [fileHash, setFileHash] = useState<string>('');
  const [existingImport, setExistingImport] = useState<any | null>(null);
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [stagedRows, setStagedRows] = useState<StagedRow[]>([]);
  const [importId, setImportId] = useState<string>('');

  // Execution Summary
  const [summaryResult, setSummaryResult] = useState<any | null>(null);

  // Mapear productos con stock actual
  const productsWithStock = useMemo(() => {
    const stockList = stocks || [];
    return products.map(p => {
      const stockItem = stockList.find(inv => inv.productId === p.id && inv.branchId === selectedBranchId);
      return {
        ...p,
        stock: stockItem ? Number(stockItem.stock) : 0
      };
    });
  }, [products, stocks, selectedBranchId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setHeadersError(null);
      setStagedRows([]);
      setExistingImport(null);
      setParsing(true);

      try {
        const hash = await computeFileHash(selectedFile);
        setFileHash(hash);
        
        // Verificar duplicidad en Supabase
        const dupImport = await checkFileHashExists(hash);
        if (dupImport) {
          setExistingImport(dupImport);
        }
      } catch (err) {
        console.error('Error al hashear el archivo:', err);
      } finally {
        setParsing(false);
      }
    }
  };

  const handleParseFile = () => {
    if (!file) return;
    setParsing(true);
    setHeadersError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Obtener filas como array de arrays para validar por posición de celda
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        
        if (rawRows.length === 0) {
          setHeadersError('El archivo seleccionado está vacío.');
          setParsing(false);
          return;
        }

        const headers = rawRows[0];
        const headerValidationError = validateExcelHeaders(headers);

        if (headerValidationError) {
          setHeadersError(headerValidationError.mensaje);
          setParsing(false);
          return;
        }

        // Analizar filas (excluyendo el encabezado en fila 0)
        const parsedRows = analyzeImportRows(rawRows.slice(1), productsWithStock);
        setStagedRows(parsedRows);
        setStep('preview');
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

    reader.readAsArrayBuffer(file);
  };

  // Cambiar resolución manual de conflictos
  const handleResolveConflict = (filaNumero: number, action: 'create_new' | 'update_by_code' | 'replace_code' | 'ignored') => {
    setStagedRows(prev => prev.map(row => {
      if (row.filaNumero === filaNumero) {
        return {
          ...row,
          action,
          estado: action === 'ignored' ? 'ignored' : 'ready'
        };
      }
      return row;
    }));
  };

  const handleConfirmAndProcess = async () => {
    if (stagedRows.length === 0 || !file) return;
    setStep('processing');

    try {
      // 1. Crear registro de importación en Supabase (Staging)
      const imp = await createStagingImport(file.name, fileHash, stagedRows.length);
      setImportId(imp.id);

      // 2. Subir las filas de staging
      await insertStagingRows(imp.id, stagedRows);

      // 3. Confirmar y ejecutar la importación en lote transaccional
      const summary = await confirmImport(imp.id, selectedBranchId);
      setSummaryResult(summary);
      setStep('summary');
    } catch (err) {
      alert(`Error al procesar la importación: ${(err as Error).message}`);
      setStep('preview');
    }
  };

  // Descargar archivo Excel de fallos
  const handleDownloadFailedReport = () => {
    if (!summaryResult || !summaryResult.errores) return;
    
    const wsData = [
      ['Fila del Excel', 'Mensaje de Error / Conflicto']
    ];
    
    summaryResult.errores.forEach((err: any) => {
      wsData.push([`Fila ${err.fila}`, err.error]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Errores de Importación');
    XLSX.writeFile(wb, `errores_importacion_${importId}.xlsx`);
  };

  // Contadores locales para vista previa
  const stats = useMemo(() => {
    let created = 0;
    let updated = 0;
    let replaced = 0;
    let conflicts = 0;
    let errors = 0;

    stagedRows.forEach(r => {
      if (r.estado === 'error') errors++;
      else if (r.estado === 'requires_review') conflicts++;
      else if (r.action === 'create_new') created++;
      else if (r.action === 'update_by_code') updated++;
      else if (r.action === 'replace_code') replaced++;
    });

    return { created, updated, replaced, conflicts, errors };
  }, [stagedRows]);

  return (
    <div className="view-container">
      <style>{`
        .step-indicator-wrapper {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          background: rgba(30, 41, 59, 0.4);
          padding: 16px 24px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .step-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-disabled);
          font-weight: 600;
          font-size: 14px;
        }
        .step-indicator.active {
          color: var(--accent-color);
        }
        .step-indicator.completed {
          color: var(--text-primary);
        }
        .step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          font-size: 12px;
        }
        .step-indicator.active .step-badge {
          background: var(--accent-color);
          color: #fff;
        }
        .preview-summary-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .preview-summary-card {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        .preview-summary-num {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }
        .conflict-row-card {
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .conflict-label-badge {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .resolution-options {
          display: flex;
          gap: 16px;
          margin-top: 12px;
        }
        .resolution-btn {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .resolution-btn.selected {
          background: var(--accent-color);
          border-color: var(--accent-color);
          color: #fff;
        }
      `}</style>

      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Importador Diario de Productos</h1>
        <p className="page-desc">Sincronización segura de catálogo y stock desde archivos Excel comerciales (.xls y .xlsx)</p>
      </div>

      {/* Stepper */}
      <div className="step-indicator-wrapper">
        <div className={`step-indicator ${step === 'upload' ? 'active' : 'completed'}`}>
          <span className="step-badge">1</span> Subida de Archivo
        </div>
        <div className={`step-indicator ${step === 'preview' ? 'active' : step === 'processing' || step === 'summary' ? 'completed' : ''}`}>
          <span className="step-badge">2</span> Vista Previa y Conflictos
        </div>
        <div className={`step-indicator ${step === 'processing' ? 'active' : step === 'summary' ? 'completed' : ''}`}>
          <span className="step-badge">3</span> Procesando
        </div>
        <div className={`step-indicator ${step === 'summary' ? 'active' : ''}`}>
          <span className="step-badge">4</span> Resumen Final
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* PASO 1: SUBIR ARCHIVO */}
      {/* ──────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="card-wrapper" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <h2 className="card-title" style={{ marginBottom: '20px' }}>Seleccione Planilla Comercial</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">Sucursal de destino para el Stock absoluto</label>
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

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Archivo Excel (.xls, .xlsx)</label>
            <div style={{ border: '2px dashed var(--border-color)', padding: '40px 20px', borderRadius: '12px', textAlign: 'center', background: 'rgba(30, 41, 59, 0.2)', marginTop: '6px' }}>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileChange} 
                style={{ cursor: 'pointer' }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-disabled)', marginTop: '12px' }}>
                Columnas requeridas por posición:<br />
                A → Codigo | C → Descripcion | D → Marca | F → Lista1 | G → Stock
              </p>
            </div>
          </div>

          {headersError && (
            <div className="badge badge-danger" style={{ display: 'block', padding: '12px', marginBottom: '20px', fontSize: '13px' }}>
              ⚠️ {headersError}
            </div>
          )}

          {existingImport && (
            <div className="badge badge-warning" style={{ display: 'block', padding: '12px', marginBottom: '20px', fontSize: '13px', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
              ⚠️ <strong>Archivo ya procesado anteriormente:</strong> Este archivo con hash coincidente fue importado el{' '}
              {new Date(existingImport.fecha).toLocaleString()} por {existingImport.usuario} con estado "{existingImport.estado.toUpperCase()}".
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              className="btn btn-primary"
              disabled={!file || parsing}
              onClick={handleParseFile}
            >
              {parsing ? 'Leyendo archivo...' : 'Siguiente: Analizar archivo ❯'}
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* PASO 2: VISTA PREVIA Y CONFLICTOS */}
      {/* ──────────────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div>
          <div className="preview-summary-grid">
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: '#10B981' }}>{stats.created}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nuevos a Crear</div>
            </div>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: '#3B82F6' }}>{stats.updated}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Actualizar por Código</div>
            </div>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: '#8B5CF6' }}>{stats.replaced}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cambios de Código</div>
            </div>
            <div className="preview-summary-card" style={{ border: stats.conflicts > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '' }}>
              <div className="preview-summary-num" style={{ color: stats.conflicts > 0 ? '#EF4444' : '#64748b' }}>{stats.conflicts}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Conflictos a Revisar</div>
            </div>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: stats.errors > 0 ? '#F59E0B' : '#64748b' }}>{stats.errors}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Filas con Error</div>
            </div>
          </div>

          {/* Listado de Conflictos */}
          {stats.conflicts > 0 && (
            <div className="card-wrapper" style={{ padding: '24px', marginBottom: '24px' }}>
              <h2 className="card-title" style={{ marginBottom: '16px', color: '#f87171' }}>
                ⚠️ Conflictos Detectados ({stats.conflicts})
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                El archivo contiene descripciones que coinciden con variantes existentes o códigos duplicados. Por favor, selecciona una resolución manual para cada una:
              </p>

              {stagedRows.filter(r => r.estado === 'requires_review').map(row => (
                <div key={row.filaNumero} className="conflict-row-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="conflict-label-badge">{row.conflictReason?.replace(/_/g, ' ')}</span>
                      <strong style={{ marginLeft: '10px', color: '#fff' }}>Fila {row.filaNumero}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
                      Código del Excel: <strong>{row.codigo}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '4px' }}>Datos en Excel:</div>
                      <div><strong>Descripción:</strong> {row.descripcion}</div>
                      <div><strong>Marca:</strong> {row.marca || '(vacía)'}</div>
                      <div><strong>Precio:</strong> {formatPrice(row.precio)} | <strong>Stock:</strong> {row.stock}</div>
                    </div>
                    {row.matchedProductId && (
                      <div>
                        <div style={{ color: '#93c5fd', fontWeight: 600, marginBottom: '4px' }}>Coincidencia Base de Datos:</div>
                        <div><strong>Nombre actual:</strong> {row.matchedProductName}</div>
                        <div><strong>Código actual:</strong> {row.matchedProductCode}</div>
                        <div><strong>Precio actual:</strong> {formatPrice(row.matchedProductPrice || 0)} | <strong>Stock actual:</strong> {row.matchedProductStock}</div>
                      </div>
                    )}
                  </div>

                  <div className="resolution-options">
                    <button 
                      className={`resolution-btn ${row.action === 'replace_code' || row.action === 'update_by_code' ? 'selected' : ''}`}
                      onClick={() => handleResolveConflict(row.filaNumero, row.matchedProductCode ? 'replace_code' : 'update_by_code')}
                    >
                      🔄 Actualizar producto existente (Unificar)
                    </button>
                    <button 
                      className={`resolution-btn ${row.action === 'create_new' ? 'selected' : ''}`}
                      onClick={() => handleResolveConflict(row.filaNumero, 'create_new')}
                    >
                      ➕ Crear como nuevo producto
                    </button>
                    <button 
                      className={`resolution-btn ${row.action === 'ignored' ? 'selected' : ''}`}
                      onClick={() => handleResolveConflict(row.filaNumero, 'ignored')}
                    >
                      🚫 Ignorar esta fila
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Listado de Errores Críticos */}
          {stats.errors > 0 && (
            <div className="card-wrapper" style={{ padding: '24px', marginBottom: '24px', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <h2 className="card-title" style={{ marginBottom: '12px', color: '#fbbf24' }}>
                ❌ Filas Rechazadas / Con Datos Inválidos ({stats.errors})
              </h2>
              <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '13px' }}>
                {stagedRows.filter(r => r.estado === 'error').map(row => (
                  <div key={row.filaNumero} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong>Fila {row.filaNumero}:</strong> {row.validationErrors?.join(' | ')} (Código: {row.codigo}, Desc: {row.descripcion})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button 
              className="btn btn-outline"
              onClick={() => setStep('upload')}
            >
              ❮ Volver a Subir
            </button>
            <button 
              className="btn btn-primary"
              disabled={stats.conflicts > 0}
              onClick={handleConfirmAndProcess}
            >
              {stats.conflicts > 0 
                ? 'Resuelva los conflictos antes de confirmar' 
                : `Confirmar e Importar ${stagedRows.length - stats.errors} Filas ❯`}
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* PASO 3: PROCESANDO */}
      {/* ──────────────────────────────────────────────────────── */}
      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ width: '60px', height: '60px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>Procesando Importación...</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Sincronizando catálogo de Supabase, registrando cambios de código, movimientos de stock e historiales de precios.
          </p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* PASO 4: RESUMEN FINAL */}
      {/* ──────────────────────────────────────────────────────── */}
      {step === 'summary' && summaryResult && (
        <div className="card-wrapper" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {summaryResult.filas_rechazadas > 0 ? '⚠️' : '✅'}
            </div>
            <h2 className="card-title" style={{ fontSize: '22px', fontWeight: 800 }}>
              Sincronización Finalizada
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
              El catálogo de Química General Deheza se actualizó con estado "<strong>{summaryResult.estado.toUpperCase()}</strong>".
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Total Filas Procesadas:</span>
              <strong>{summaryResult.cantidad_filas}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#10B981' }}>
              <span>Productos Creados:</span>
              <strong>+ {summaryResult.productos_creados}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#60A5FA' }}>
              <span>Productos Sincronizados / Actualizados:</span>
              <strong>{summaryResult.productos_actualizados}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#F59E0B' }}>
              <span>Filas con Fallas / Rechazadas:</span>
              <strong>{summaryResult.filas_rechazadas}</strong>
            </div>
          </div>

          {summaryResult.filas_rechazadas > 0 && (
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <button 
                className="btn btn-outline" 
                onClick={handleDownloadFailedReport}
                style={{ width: '100%' }}
              >
                📥 Descargar Excel de Errores ({summaryResult.filas_rechazadas})
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setFile(null);
                setStagedRows([]);
                setSummaryResult(null);
                setStep('upload');
              }}
            >
              Realizar Nueva Importación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
