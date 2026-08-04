import React, { useState, useMemo, useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { DeliveryZone } from '@shared/types/zone';
import type { BranchSchedule, DaySchedule } from '@shared/types/schedule';
import { formatPrice } from '@shared/utils/formatCurrency';
import { deliverySlotService } from '@shared/services/deliverySlotService';



export function ZonesView() {
  const { 
    zones, 
    schedules, 
    branches, 
    activeBranchId, 
    updateZone, 
    createZone, 
    updateSchedule 
  } = useAdminStore();

  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [activeTab, setActiveTab] = useState<'zones' | 'schedules' | 'slots'>('zones');

  // Estados para Franjas Horarias (Etapa 7)
  const [slots, setSlots] = useState<any[]>([]);
  const [editingSlot, setEditingSlot] = useState<any | null>(null);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [formSlot, setFormSlot] = useState({
    nombre: '',
    hora_inicio: '08:00',
    hora_fin: '12:00',
    max_pedidos: 10,
    activo: true
  });

  const loadSlots = async () => {
    try {
      const allSlots = await deliverySlotService.getAll();
      setSlots(allSlots);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'slots') {
      loadSlots();
    }
  }, [activeTab]);

  const handleOpenCreateSlot = () => {
    setIsCreatingSlot(true);
    setFormSlot({
      nombre: '',
      hora_inicio: '08:00',
      hora_fin: '12:00',
      max_pedidos: 10,
      activo: true
    });
  };

  const handleOpenEditSlot = (slot: any) => {
    setEditingSlot(slot);
    setFormSlot({
      nombre: slot.nombre,
      hora_inicio: slot.hora_inicio,
      hora_fin: slot.hora_fin,
      max_pedidos: slot.max_pedidos || 10,
      activo: slot.activo
    });
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSlot) {
        await deliverySlotService.update(editingSlot.id, formSlot);
      } else {
        await deliverySlotService.create(formSlot);
      }
      setEditingSlot(null);
      setIsCreatingSlot(false);
      loadSlots();
    } catch (err: any) {
      alert('Error al guardar la franja horaria: ' + err.message);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar esta franja horaria?')) {
      try {
        await deliverySlotService.delete(id);
        loadSlots();
      } catch (err: any) {
        alert('Error al eliminar: ' + err.message);
      }
    }
  };


  // Form State for Zone
  const [formZone, setFormZone] = useState({
    branchId: 'branch-gd1',
    nombre: '',
    costoEnvio: 0,
    pedidoMinimo: 0,
    diasReparto: [] as string[],
    horarioEntrega: '08:00 - 12:00',
    activo: true,
  });

  // Selected branch schedule to edit
  const selectedBranchIdForSchedule = activeBranchId === 'all' ? (branches[0]?.id || 'branch-gd1') : activeBranchId;
  const currentSchedule = useMemo(() => {
    return schedules.find(s => s.branchId === selectedBranchIdForSchedule) || null;
  }, [schedules, selectedBranchIdForSchedule]);

  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  const daysOfWeek = [
    { value: 'lunes', label: 'Lunes' },
    { value: 'martes', label: 'Martes' },
    { value: 'miercoles', label: 'Miércoles' },
    { value: 'jueves', label: 'Jueves' },
    { value: 'viernes', label: 'Viernes' },
    { value: 'sabado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' },
  ];

  // Filter zones list by branch
  const filteredZones = useMemo(() => {
    return zones.filter(z => activeBranchId === 'all' || z.branchId === activeBranchId);
  }, [zones, activeBranchId]);

  const getBranchName = (bId: string) => {
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const handleOpenEditZone = (z: DeliveryZone) => {
    setEditingZone(z);
    setFormZone({
      branchId: z.branchId,
      nombre: z.nombre,
      costoEnvio: z.costoEnvio,
      pedidoMinimo: z.pedidoMinimo,
      diasReparto: z.diasReparto,
      horarioEntrega: z.horarioEntrega,
      activo: z.activo,
    });
  };

  const handleOpenCreateZone = () => {
    setIsCreatingZone(true);
    setFormZone({
      branchId: activeBranchId === 'all' ? 'branch-gd1' : activeBranchId,
      nombre: '',
      costoEnvio: 0,
      pedidoMinimo: 0,
      diasReparto: ['lunes', 'miercoles', 'viernes'],
      horarioEntrega: '09:00 - 13:00',
      activo: true,
    });
  };

  const toggleDaySelection = (day: string) => {
    setFormZone(prev => ({
      ...prev,
      diasReparto: prev.diasReparto.includes(day)
        ? prev.diasReparto.filter(d => d !== day)
        : [...prev.diasReparto, day]
    }));
  };

  const handleSaveZoneEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;
    updateZone(editingZone.id, formZone);
    setEditingZone(null);
  };

  const handleSaveZoneCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createZone(formZone);
    setIsCreatingZone(false);
  };

  // Schedule manipulation
  const handleUpdateDaySchedule = (
    type: 'horariosAtencion' | 'horariosRetiro',
    dia: string,
    field: 'horario' | 'cerrado',
    value: string | boolean
  ) => {
    if (!currentSchedule) return;

    const list = currentSchedule[type].map(item => {
      if (item.dia === dia) {
        return { ...item, [field]: value };
      }
      return item;
    });

    updateSchedule(selectedBranchIdForSchedule, { [type]: list });
  };

  const handleAddBlockedDate = () => {
    if (!currentSchedule || !newBlockedDate) return;
    if (currentSchedule.fechasBloqueadas.includes(newBlockedDate)) return;

    updateSchedule(selectedBranchIdForSchedule, {
      fechasBloqueadas: [...currentSchedule.fechasBloqueadas, newBlockedDate],
    });
    setNewBlockedDate('');
  };

  const handleRemoveBlockedDate = (date: string) => {
    if (!currentSchedule) return;
    updateSchedule(selectedBranchIdForSchedule, {
      fechasBloqueadas: currentSchedule.fechasBloqueadas.filter(d => d !== date),
    });
  };

  const handleAddHolidayDate = () => {
    if (!currentSchedule || !newHolidayDate) return;
    if (currentSchedule.feriados.includes(newHolidayDate)) return;

    updateSchedule(selectedBranchIdForSchedule, {
      feriados: [...currentSchedule.feriados, newHolidayDate],
    });
    setNewHolidayDate('');
  };

  const handleRemoveHolidayDate = (date: string) => {
    if (!currentSchedule) return;
    updateSchedule(selectedBranchIdForSchedule, {
      feriados: currentSchedule.feriados.filter(d => d !== date),
    });
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Zonas, Horarios y Logística</h1>
          <p className="page-desc">Configuración de radios de entrega, costos de despacho, mínimos de compra y agendas operativas</p>
        </div>
        {activeTab === 'zones' && (
          <button className="btn btn-primary" onClick={handleOpenCreateZone}>
            ➕ Agregar Nueva Zona
          </button>
        )}
        {activeTab === 'slots' && (
          <button className="btn btn-primary" onClick={handleOpenCreateSlot}>
            ➕ Agregar Franja Horaria
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '20px' }}>
        <button 
          style={{ 
            padding: '12px 24px', 
            fontWeight: '600', 
            fontSize: '14px', 
            border: 'none', 
            background: 'none', 
            borderBottom: activeTab === 'zones' ? '3px solid var(--accent-color)' : 'none', 
            color: activeTab === 'zones' ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer' 
          }}
          onClick={() => setActiveTab('zones')}
        >
          📍 Zonas de Entrega
        </button>
        <button 
          style={{ 
            padding: '12px 24px', 
            fontWeight: '600', 
            fontSize: '14px', 
            border: 'none', 
            background: 'none', 
            borderBottom: activeTab === 'schedules' ? '3px solid var(--accent-color)' : 'none', 
            color: activeTab === 'schedules' ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer' 
          }}
          onClick={() => setActiveTab('schedules')}
        >
          📅 Horarios de Sucursal
        </button>
        <button 
          style={{ 
            padding: '12px 24px', 
            fontWeight: '600', 
            fontSize: '14px', 
            border: 'none', 
            background: 'none', 
            borderBottom: activeTab === 'slots' ? '3px solid var(--accent-color)' : 'none', 
            color: activeTab === 'slots' ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer' 
          }}
          onClick={() => setActiveTab('slots')}
        >
          🕒 Franjas Horarias de Entrega
        </button>
      </div>


      {/* VIEW 1: Zonas de Entrega */}
      {activeTab === 'zones' && (
        <div className="card-wrapper">
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre Zona</th>
                  <th>Sucursal Asignada</th>
                  <th>Pedido Mínimo</th>
                  <th>Costo de Envío</th>
                  <th>Días de Reparto</th>
                  <th>Franja Horaria</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.map(z => (
                  <tr key={z.id}>
                    <td style={{ fontWeight: 'bold' }}>{z.nombre}</td>
                    <td><span className="badge badge-neutral">{getBranchName(z.branchId)}</span></td>
                    <td style={{ fontWeight: '600', color: 'var(--success-color)' }}>{formatPrice(z.pedidoMinimo)}</td>
                    <td style={{ fontWeight: '600' }}>{z.costoEnvio === 0 ? 'Sin Costo (Gratis)' : formatPrice(z.costoEnvio)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {z.diasReparto.map((d, idx) => (
                          <span key={idx} className="badge badge-neutral" style={{ fontSize: '11px', textTransform: 'capitalize' }}>{d}</span>
                        ))}
                      </div>
                    </td>
                    <td>🕒 {z.horarioEntrega}</td>
                    <td>
                      <span className={`badge ${z.activo ? 'badge-success' : 'badge-error'}`}>
                        {z.activo ? 'Habilitada' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-secondary" onClick={() => handleOpenEditZone(z)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredZones.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                      No se encontraron zonas cargadas para esta sucursal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Horarios y Calendarios */}
      {activeTab === 'schedules' && currentSchedule && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', gap: '16px', background: 'var(--accent-light)', padding: '12px 16px', borderRadius: '8px', color: '#0369a1', fontSize: '14px', alignItems: 'center' }}>
            <span>Visualizando horarios para la sucursal activa: <strong>{getBranchName(selectedBranchIdForSchedule)}</strong>. Cambie la sucursal activa en el selector superior para editar otra sucursal.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
            {/* Horarios de Atención */}
            <div className="card-wrapper" style={{ padding: '20px' }}>
              <h3 style={{ marginTop: 0, fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>📞 Horarios de Atención al Cliente</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentSchedule.horariosAtencion.map((sch, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '13px', width: '100px' }}>{sch.dia}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '4px 8px', width: '120px', fontSize: '13px' }}
                        value={sch.horario} 
                        disabled={sch.cerrado}
                        onChange={e => handleUpdateDaySchedule('horariosAtencion', sch.dia, 'horario', e.target.value)}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={sch.cerrado} 
                          onChange={e => handleUpdateDaySchedule('horariosAtencion', sch.dia, 'cerrado', e.target.checked)}
                        />
                        Cerrado
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Horarios de Retiro */}
            <div className="card-wrapper" style={{ padding: '20px' }}>
              <h3 style={{ marginTop: 0, fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>🛍️ Horarios para Retiros en Local</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentSchedule.horariosRetiro.map((sch, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '13px', width: '100px' }}>{sch.dia}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '4px 8px', width: '120px', fontSize: '13px' }}
                        value={sch.horario} 
                        disabled={sch.cerrado}
                        onChange={e => handleUpdateDaySchedule('horariosRetiro', sch.dia, 'horario', e.target.value)}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={sch.cerrado} 
                          onChange={e => handleUpdateDaySchedule('horariosRetiro', sch.dia, 'cerrado', e.target.checked)}
                        />
                        Cerrado
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
            {/* Fechas Bloqueadas */}
            <div className="card-wrapper" style={{ padding: '20px' }}>
              <h3 style={{ marginTop: 0, fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>🛑 Fechas Bloqueadas (Sin Repartos)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Días específicos del año donde no se realizan envíos.</p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="date" 
                  className="form-input" 
                  value={newBlockedDate} 
                  onChange={e => setNewBlockedDate(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleAddBlockedDate}>
                  ➕ Bloquear
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '150px', overflowY: 'auto' }}>
                {currentSchedule.fechasBloqueadas.map(date => (
                  <span key={date} className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '12px' }}>
                    📅 {date}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveBlockedDate(date)}
                      style={{ border: 'none', background: 'none', color: 'var(--error-color)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {currentSchedule.fechasBloqueadas.length === 0 && (
                  <span style={{ fontSize: '13px', color: 'var(--text-disabled)' }}>No hay fechas bloqueadas asignadas.</span>
                )}
              </div>
            </div>

            {/* Feriados */}
            <div className="card-wrapper" style={{ padding: '20px' }}>
              <h3 style={{ marginTop: 0, fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>🎉 Feriados (Cerrado)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Días no laborables nacionales o municipales donde la sucursal cierra.</p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="date" 
                  className="form-input" 
                  value={newHolidayDate} 
                  onChange={e => setNewHolidayDate(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleAddHolidayDate}>
                  ➕ Agregar
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '150px', overflowY: 'auto' }}>
                {currentSchedule.feriados.map(date => (
                  <span key={date} className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '12px', color: '#854d0e', background: '#fef3c7' }}>
                    🏖️ {date}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveHolidayDate(date)}
                      style={{ border: 'none', background: 'none', color: '#854d0e', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {currentSchedule.feriados.length === 0 && (
                  <span style={{ fontSize: '13px', color: 'var(--text-disabled)' }}>No hay feriados cargados.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Zona */}
      {editingZone && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <form onSubmit={handleSaveZoneEdit}>
              <div className="modal-header">
                <h2 className="card-title">Editar Zona de Entrega</h2>
                <button type="button" className="btn-close" onClick={() => setEditingZone(null)}>✕</button>
              </div>
              <div className="modal-body">
                
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Zona</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formZone.nombre}
                      onChange={e => setFormZone({ ...formZone, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sucursal Responsable</label>
                    <select 
                      className="form-select"
                      value={formZone.branchId}
                      onChange={e => setFormZone({ ...formZone, branchId: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Costo Envío ($)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formZone.costoEnvio}
                      onChange={e => setFormZone({ ...formZone, costoEnvio: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pedido Mínimo ($)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formZone.pedidoMinimo}
                      onChange={e => setFormZone({ ...formZone, pedidoMinimo: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Días de Reparto</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {daysOfWeek.map(day => (
                      <button 
                        key={day.value}
                        type="button"
                        className={`btn ${formZone.diasReparto.includes(day.value) ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => toggleDaySelection(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Franja Horaria de Entrega</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formZone.horarioEntrega}
                      onChange={e => setFormZone({ ...formZone, horarioEntrega: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado Zona</label>
                    <select 
                      className="form-select"
                      value={formZone.activo ? 'true' : 'false'}
                      onChange={e => setFormZone({ ...formZone, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activa / Habilitada</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingZone(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Zona */}
      {isCreatingZone && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <form onSubmit={handleSaveZoneCreate}>
              <div className="modal-header">
                <h2 className="card-title">Agregar Nueva Zona de Entrega</h2>
                <button type="button" className="btn-close" onClick={() => setIsCreatingZone(false)}>✕</button>
              </div>
              <div className="modal-body">
                
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Zona</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Zona Norte Río Cuarto"
                      value={formZone.nombre}
                      onChange={e => setFormZone({ ...formZone, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sucursal Responsable</label>
                    <select 
                      className="form-select"
                      value={formZone.branchId}
                      onChange={e => setFormZone({ ...formZone, branchId: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Costo Envío ($)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="0 para envío gratis"
                      value={formZone.costoEnvio || ''}
                      onChange={e => setFormZone({ ...formZone, costoEnvio: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pedido Mínimo ($)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Ej: 15000"
                      value={formZone.pedidoMinimo || ''}
                      onChange={e => setFormZone({ ...formZone, pedidoMinimo: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Días de Reparto</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {daysOfWeek.map(day => (
                      <button 
                        key={day.value}
                        type="button"
                        className={`btn ${formZone.diasReparto.includes(day.value) ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => toggleDaySelection(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Franja Horaria de Entrega</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 09:00 a 13:00"
                      value={formZone.horarioEntrega}
                      onChange={e => setFormZone({ ...formZone, horarioEntrega: e.target.value })}
                      required
                    />
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreatingZone(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar Zona</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 3: Franjas Horarias de Entrega (Etapa 7) */}
      {activeTab === 'slots' && (
        <div className="card-wrapper">
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Hora de Inicio</th>
                  <th>Hora de Fin</th>
                  <th>Capacidad Máxima (Pedidos)</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {slots.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 'bold' }}>{s.nombre}</td>
                    <td>{s.hora_inicio} hs</td>
                    <td>{s.hora_fin} hs</td>
                    <td>
                      {s.max_pedidos ? (
                        <span className="badge badge-neutral">{s.max_pedidos} pedidos</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ color: '#64748b' }}>Sin límite</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.activo ? 'badge-success' : 'badge-error'}`}>
                        {s.activo ? 'Activa' : 'Desactivada'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => handleOpenEditSlot(s)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                          ✏️ Editar
                        </button>
                        <button 
                          className="btn" 
                          onClick={() => handleDeleteSlot(s.id)} 
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '12px', 
                            backgroundColor: '#ef4444', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer' 
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {slots.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                      No se encontraron franjas horarias cargadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Franja Horaria (Etapa 7) */}
      {(isCreatingSlot || editingSlot) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <form onSubmit={handleSaveSlot}>
              <div className="modal-header">
                <h2 className="card-title">
                  {editingSlot ? 'Editar Franja Horaria' : 'Nueva Franja Horaria de Entrega'}
                </h2>
                <button type="button" className="btn-close" onClick={() => { setIsCreatingSlot(false); setEditingSlot(null); }}>✕</button>
              </div>
              <div className="modal-body">
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Nombre de la Franja</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Mañana, Tarde, Mediodía"
                    value={formSlot.nombre}
                    onChange={e => setFormSlot({ ...formSlot, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Hora Inicio (HH:MM)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="08:00"
                      value={formSlot.hora_inicio}
                      onChange={e => setFormSlot({ ...formSlot, hora_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hora Fin (HH:MM)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="12:00"
                      value={formSlot.hora_fin}
                      onChange={e => setFormSlot({ ...formSlot, hora_fin: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Límite de Pedidos</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Ej: 10"
                      value={formSlot.max_pedidos || ''}
                      onChange={e => setFormSlot({ ...formSlot, max_pedidos: parseInt(e.target.value) || 0 })}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select"
                      value={formSlot.activo ? 'true' : 'false'}
                      onChange={e => setFormSlot({ ...formSlot, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activa / Habilitada</option>
                      <option value="false">Desactivada</option>
                    </select>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setIsCreatingSlot(false); setEditingSlot(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {editingSlot ? 'Guardar Cambios' : 'Crear Franja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

