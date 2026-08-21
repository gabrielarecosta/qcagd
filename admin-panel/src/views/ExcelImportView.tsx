import React, { useState, useMemo, useEffect } from 'react';
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
    checkDuplicateImport,
    fetchImportsHistory,
    createStagingImport,
    insertStagingRows,
    confirmImport
  } = useAdminStore();

  const [selectedBranchId, setSelectedBranchId] = useState<string | number>(branches[0]?.id || 1);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  
  // Duplicados y confirmaciones
  const [duplicateMatch, setDuplicateMatch] = useState<any | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [userConfirmedDuplicate, setUserConfirmedDuplicate] = useState(false);
  
  // Historial e información de última sincronización
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showHistoryTable, setShowHistoryTable] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchImportsHistory(25);
      setHistory(data);
    } catch (err) {
      console.warn('Error cargando historial de importaciones:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const lastSuccessfulSync = useMemo(() => {
    return history.find(h => {
      const st = String(h.estado || '').toLowerCase();
      return st === 'completed' || st === 'completed_with_errors' || st === 'completado';
    });
  }, [history]);

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
      setDuplicateMatch(null);
      setShowDuplicateModal(false);
      setUserConfirmedDuplicate(false);
      setParsing(true);

      try {
        const hash = await computeFileHash(selectedFile);
        setFileHash(hash);
        
        // Verificar duplicidad por nombre de archivo o por hash
        const dupImport = await checkDuplicateImport(selectedFile.name, hash);
        if (dupImport) {
          setExistingImport(dupImport);
          setDuplicateMatch(dupImport);
          setShowDuplicateModal(true);
        }
      } catch (err) {
        console.error('Error al verificar duplicidad del archivo:', err);
      } finally {
        setParsing(false);
      }
    }
  };

  const handleParseFile = () => {
    if (!file) return;

    if (duplicateMatch && !userConfirmedDuplicate) {
      setShowDuplicateModal(true);
      return;
    }

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
      loadHistory();
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

      {/* BANNER DE ÚLTIMA SINCRONIZACIÓN Y ACCESO AL HISTORIAL */}
      {step === 'upload' && (
        <div style={{ marginBottom: '28px' }}>
          {lastSuccessfulSync ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '16px',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '18px' }}>🟢</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Última Sincronización Exitosa
                  </span>
                </div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', marginBottom: '4px' }}>
                  📁 {lastSuccessfulSync.nombre_archivo || lastSuccessfulSync.file_name || 'Archivo Excel de Productos'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  🗓️ <strong>{new Date(lastSuccessfulSync.fecha || lastSuccessfulSync.created_at).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })} hs</strong>
                  {lastSuccessfulSync.usuario ? ` • 👤 Cargado por ${lastSuccessfulSync.usuario}` : ''}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    ✓ {lastSuccessfulSync.productos_creados || 0} Creados
                  </span>
                  <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    🔄 {lastSuccessfulSync.productos_actualizados || 0} Actualizados
                  </span>
                  <span className="badge badge-secondary" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.08)' }}>
                    📊 {lastSuccessfulSync.cantidad_filas || 0} Filas Procesadas
                  </span>
                </div>
              </div>

              <div>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowHistoryTable(!showHistoryTable)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
                >
                  📜 {showHistoryTable ? 'Ocultar Historial' : 'Ver Historial de Cargas'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                ℹ️ No hay registros de sincronización previa cargados.
              </span>
              <button
                className="btn btn-outline"
                onClick={() => setShowHistoryTable(!showHistoryTable)}
              >
                📜 {showHistoryTable ? 'Ocultar Historial' : 'Ver Historial de Cargas'}
              </button>
            </div>
          )}

          {/* TABLA DE HISTORIAL DE IMPORTACIONES */}
          {showHistoryTable && (
            <div className="card-wrapper" style={{ marginTop: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ fontSize: '16px', fontWeight: 700 }}>
                  📜 Historial de Archivos Cargados
                </h3>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={loadHistory}
                  disabled={loadingHistory}
                >
                  {loadingHistory ? 'Cargando...' : '🔄 Actualizar'}
                </button>
              </div>

              {history.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-disabled)', textAlign: 'center', padding: '20px' }}>
                  No se encontraron cargas de Excel registradas en el sistema.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Fecha y Hora</th>
                        <th>Nombre del Archivo</th>
                        <th>Usuario / Responsable</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'center' }}>Filas</th>
                        <th style={{ textAlign: 'center' }}>Creados</th>
                        <th style={{ textAlign: 'center' }}>Actualizados</th>
                        <th style={{ textAlign: 'center' }}>Rechazados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h: any) => {
                        const dateStr = new Date(h.fecha || h.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        const fileName = h.nombre_archivo || h.file_name || 'Archivo sin nombre';
                        const status = String(h.estado || '').toLowerCase();
                        const isOk = status === 'completed' || status === 'completado';
                        const isWarn = status === 'completed_with_errors';
                        const isErr = status === 'failed' || status === 'error';

                        return (
                          <tr key={h.id}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{dateStr} hs</td>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fileName}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{h.usuario || 'Sistema'}</td>
                            <td>
                              <span className={`badge ${isOk ? 'badge-success' : isWarn ? 'badge-warning' : isErr ? 'badge-danger' : 'badge-primary'}`}>
                                {isOk ? '✓ COMPLETADO' : isWarn ? '⚠️ CON ERRORES' : isErr ? '❌ FALLIDO' : status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>{h.cantidad_filas || 0}</td>
                            <td style={{ textAlign: 'center', color: '#10B981', fontWeight: 700 }}>+ {h.productos_creados || 0}</td>
                            <td style={{ textAlign: 'center', color: '#60A5FA', fontWeight: 700 }}>{h.productos_actualizados || 0}</td>
                            <td style={{ textAlign: 'center', color: h.filas_rechazadas > 0 ? '#EF4444' : 'var(--text-disabled)', fontWeight: h.filas_rechazadas > 0 ? 700 : 400 }}>
                              {h.filas_rechazadas || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
          <div className="preview-summary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: '#3B82F6' }}>{stats.updated + stats.replaced}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Productos a Actualizar (Stock/Precio)</div>
            </div>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: '#8B5CF6' }}>{stats.replaced}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Códigos Nuevos Unificados</div>
            </div>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: '#10B981' }}>{stats.created}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nuevos a Incorporar</div>
            </div>
            <div className="preview-summary-card">
              <div className="preview-summary-num" style={{ color: stats.errors > 0 ? '#EF4444' : '#64748b' }}>{stats.errors}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Filas con Error</div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.25)', 
            borderRadius: '12px', 
            padding: '16px 20px', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '19px' }}>
              <strong>Detección inteligente de productos activa:</strong> Si el Excel contiene artículos con el mismo nombre que ya existen en el catálogo, el sistema sincroniza automáticamente su código y actualiza su stock y precio para dejarlos listos para la venta de inmediato sin requerir revisión manual.
            </div>
          </div>

          {/* Listado de Conflictos (si hubiera alguno manual pendiente) */}
          {stats.conflicts > 0 && (
            <div className="card-wrapper" style={{ padding: '24px', marginBottom: '24px' }}>
              <h2 className="card-title" style={{ marginBottom: '16px', color: '#f87171' }}>
                ⚠️ Conflictos Detectados ({stats.conflicts})
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                El archivo contiene descripciones que requieren una confirmación de unificación:
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
              style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 'bold' }}
            >
              {stats.conflicts > 0 
                ? 'Resuelva los conflictos antes de confirmar' 
                : `Confirmar e Importar ${stagedRows.length - stats.errors} Productos ❯`}
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

      {/* ──────────────────────────────────────────────────────── */}
      {/* MODAL INTERACTIVO DE CONFIRMACIÓN DE ARCHIVO REPETIDO */}
      {/* ──────────────────────────────────────────────────────── */}
      {showDuplicateModal && duplicateMatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card-wrapper" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            borderRadius: '20px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            background: '#1E293B'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                marginBottom: '12px'
              }}>
                ⚠️
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFF' }}>
                Este archivo ya fue subido anteriormente
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {duplicateMatch.matchReason === 'name' 
                  ? 'Se encontró una planilla con el mismo nombre de archivo registrada previamente.'
                  : 'Se encontró una planilla con el mismo contenido (HASH SHA-256) cargada anteriormente.'}
              </p>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '13px',
              lineHeight: '22px'
            }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>📄 Archivo:</strong> <span style={{ color: '#60A5FA', fontWeight: 600 }}>{duplicateMatch.nombre_archivo || duplicateMatch.file_name || file?.name}</span>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>🗓️ Fecha de Carga Anterior:</strong> {new Date(duplicateMatch.fecha || duplicateMatch.created_at).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })} hs
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>👤 Subido por:</strong> {duplicateMatch.usuario || 'Sistema'}
              </div>
              <div>
                <strong>📊 Estado Anterior:</strong> <span className="badge badge-warning" style={{ fontSize: '11px', marginLeft: '6px' }}>{(duplicateMatch.estado || '').toUpperCase()}</span>
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '14px',
              color: '#F59E0B',
              marginBottom: '24px'
            }}>
              ¿Deseás procesarlo de nuevo y actualizar los precios y stocks?
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, padding: '12px', borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={() => {
                  setFile(null);
                  setExistingImport(null);
                  setDuplicateMatch(null);
                  setShowDuplicateModal(false);
                  setUserConfirmedDuplicate(false);
                }}
              >
                🔴 Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px', backgroundColor: '#10B981', borderColor: '#10B981', fontWeight: 700 }}
                onClick={() => {
                  setUserConfirmedDuplicate(true);
                  setShowDuplicateModal(false);
                  handleParseFile();
                }}
              >
                🟢 Sí, volver a subir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
