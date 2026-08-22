import React, { useState, useMemo, useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { Customer, ClientType, CustomerAddress } from '@shared/types/client';
import { clientService } from '@shared/services/clientService';
import { formatPrice } from '@shared/utils/formatCurrency';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';

import { AddressLocationPicker } from '../components/AddressLocationPicker';
import { ExtraModuleWrapper } from '../components/ExtraModuleWrapper';

interface ClientsViewProps {
  initialSection?: 'directorio' | 'ctaCte';
}

export function ClientsView({ initialSection = 'directorio' }: ClientsViewProps) {
  const { clients, branches, orders, updateClient, createClient, activeBranchId, fetchClientsOnly, fetchOrdersOnly } = useAdminStore();

  const [activeSection, setActiveSection] = useState<'directorio' | 'ctaCte'>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    fetchClientsOnly();
    fetchOrdersOnly();
  }, []);

  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedActiveStatus, setSelectedActiveStatus] = useState<string>('all');
  const [selectedCtaCteStatus, setSelectedCtaCteStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('fecha_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  const [editingClient, setEditingClient] = useState<Customer | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranch, selectedType, selectedActiveStatus, selectedCtaCteStatus, sortBy, itemsPerPage]);

  // Estados para Sección de Cuentas Corrientes
  const [ctaCteTab, setCtaCteTab] = useState<'minoristas' | 'mayoristas' | 'pendientes'>('minoristas');
  const [ctaCteSearch, setCtaCteSearch] = useState('');
  const [editingLimitClientId, setEditingLimitClientId] = useState<string | number | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState<number>(0);
  const [inspectingOrdersClient, setInspectingOrdersClient] = useState<Customer | null>(null);

  // Estados para Direcciones Adicionales / Auxiliares
  const [clientAddresses, setClientAddresses] = useState<CustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddrText, setEditAddrText] = useState('');
  const [editAddrIndicaciones, setEditAddrIndicaciones] = useState('');
  
  // Estado para agregar nueva dirección auxiliar
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrText, setNewAddrText] = useState('');
  const [newAddrIndicaciones, setNewAddrIndicaciones] = useState('');
  const [addingAddr, setAddingAddr] = useState(false);

  // Form State
  const [formClient, setFormClient] = useState<{
    nombre: string;
    razonSocial: string;
    cuit: string;
    email: string;
    telefono: string;
    direccion: string;
    branchId: string | number;
    tipoCliente: ClientType;
    activo: boolean;
    observaciones: string;
    latitude?: number;
    longitude?: number;
    ctaCteAutorizada: boolean;
    limiteCredito: number;
    mayoristaAutorizado: boolean;
  }>({
    nombre: '',
    razonSocial: '',
    cuit: '',
    email: '',
    telefono: '',
    direccion: '',
    branchId: 1,
    tipoCliente: 'minorista' as ClientType,
    activo: true,
    observaciones: '',
    ctaCteAutorizada: false,
    limiteCredito: 0,
    mayoristaAutorizado: true,
  });

  const fetchAddresses = async (customerId: string | number) => {
    setLoadingAddresses(true);
    try {
      const addrs = await clientService.getAddresses(String(customerId));
      setClientAddresses(addrs);
    } catch (err) {
      console.warn('Error cargando direcciones auxiliares:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingClient(c);
    setEditingAddressId(null);
    setShowAddAddress(false);
    setNewAddrText('');
    setNewAddrIndicaciones('');
    setFormClient({
      nombre: c.nombre || '',
      razonSocial: c.razonSocial || '',
      cuit: c.cuit || '',
      email: c.email || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      branchId: c.branchId,
      tipoCliente: c.tipoCliente,
      activo: c.activo,
      observaciones: c.observaciones || '',
      latitude: c.latitude,
      longitude: c.longitude,
      ctaCteAutorizada: c.ctaCteAutorizada || false,
      limiteCredito: c.limiteCredito || 0,
      mayoristaAutorizado: c.mayoristaAutorizado ?? (c.tipoCliente !== 'mayorista' && c.tipoCliente !== 'sucursal'),
    });
    fetchAddresses(String(c.id));
  };

  const handleOpenCreate = () => {
    setIsCreating(true);
    setFormClient({
      nombre: '',
      razonSocial: '',
      cuit: '',
      email: '',
      telefono: '',
      direccion: '',
      branchId: activeBranchId !== 'all' ? activeBranchId : 1,
      tipoCliente: 'minorista',
      activo: true,
      observaciones: '',
      latitude: undefined,
      longitude: undefined,
      ctaCteAutorizada: false,
      limiteCredito: 0,
      mayoristaAutorizado: true,
    });
  };


  const handleAddAuxAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !newAddrText.trim()) return;
    setAddingAddr(true);
    try {
      await clientService.addAddress({
        customerId: String(editingClient.id),
        direccion: newAddrText.trim(),
        indicaciones: newAddrIndicaciones.trim() || undefined,
      });
      setNewAddrText('');
      setNewAddrIndicaciones('');
      setShowAddAddress(false);
      await fetchAddresses(String(editingClient.id));
    } catch (err: any) {
      alert('Error agregando dirección auxiliar: ' + err.message);
    } finally {
      setAddingAddr(false);
    }
  };

  const handleStartEditAuxAddr = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id ? String(addr.id) : null);
    setEditAddrText(addr.direccion);
    setEditAddrIndicaciones(addr.indicaciones || '');
  };

  const handleSaveAuxAddress = async (addrId: string) => {
    if (!editingClient || !editAddrText.trim()) return;
    try {
      await clientService.updateAddress(addrId, {
        direccion: editAddrText.trim(),
        indicaciones: editAddrIndicaciones.trim() || undefined,
      });
      setEditingAddressId(null);
      await fetchAddresses(String(editingClient.id));
    } catch (err: any) {
      alert('Error guardando dirección: ' + err.message);
    }
  };

  const handleDeleteAuxAddress = async (addrId: string) => {
    if (!editingClient || !confirm('¿Confirma eliminar esta dirección secundaria del cliente?')) return;
    try {
      await clientService.deleteAddress(addrId);
      await fetchAddresses(String(editingClient.id));
    } catch (err: any) {
      alert('Error eliminando dirección: ' + err.message);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    updateClient(editingClient.id, formClient);
    setEditingClient(null);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createClient(formClient);
    setIsCreating(false);
  };

  const getBranchName = (bId: string | number) => {
    const b = branches.find(item => String(item.id) === String(bId));
    return b ? b.nombre : 'Sin sucursal';
  };

  // Filtrado, Ordenamiento y Paginación de Clientes
  const filteredAndSortedClients = useMemo(() => {
    const filtered = clients.filter(c => {
      const q = search.toLowerCase();
      const matchesSearch = 
        !q ||
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.razonSocial || '').toLowerCase().includes(q) ||
        (c.cuit || '').includes(q) ||
        (c.direccion || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.telefono || '').includes(q);

      const globalBranchFilter = activeBranchId === 'all' || String(c.branchId) === String(activeBranchId);
      const localBranchFilter = selectedBranch === 'all' || String(c.branchId) === String(selectedBranch);
      const matchesType = selectedType === 'all' || c.tipoCliente === selectedType;

      const matchesStatus = selectedActiveStatus === 'all' || 
        (selectedActiveStatus === 'activo' && c.activo) ||
        (selectedActiveStatus === 'suspendido' && !c.activo);

      const matchesCtaCte = selectedCtaCteStatus === 'all' ||
        (selectedCtaCteStatus === 'habilitada' && c.ctaCteAutorizada) ||
        (selectedCtaCteStatus === 'no_habilitada' && !c.ctaCteAutorizada);

      return matchesSearch && globalBranchFilter && localBranchFilter && matchesType && matchesStatus && matchesCtaCte;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'nombre_asc') {
        return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      } else if (sortBy === 'nombre_desc') {
        return (b.nombre || '').localeCompare(a.nombre || '', 'es');
      } else if (sortBy === 'razon_asc') {
        return (a.razonSocial || a.nombre || '').localeCompare(b.razonSocial || b.nombre || '', 'es');
      } else if (sortBy === 'cuit_asc') {
        return (a.cuit || '').localeCompare(b.cuit || '');
      } else if (sortBy === 'fecha_desc') {
        return new Date(b.fechaAlta || 0).getTime() - new Date(a.fechaAlta || 0).getTime();
      } else if (sortBy === 'fecha_asc') {
        return new Date(a.fechaAlta || 0).getTime() - new Date(b.fechaAlta || 0).getTime();
      } else if (sortBy === 'egresos_desc') {
        const totalA = orders.filter(o => String(o.clienteId) === String(a.id) && o.estado !== 'cancelado').reduce((sum, o) => sum + o.total, 0);
        const totalB = orders.filter(o => String(o.clienteId) === String(b.id) && o.estado !== 'cancelado').reduce((sum, o) => sum + o.total, 0);
        return totalB - totalA;
      } else if (sortBy === 'deuda_desc') {
        const custIdA = String(a.id);
        const custIdB = String(b.id);
        const deudaA = orders.filter(o => String(o.clienteId) === custIdA && o.estado !== 'cancelado' && o.paymentStatus !== 'pagado').reduce((sum, o) => sum + o.total, 0);
        const deudaB = orders.filter(o => String(o.clienteId) === custIdB && o.estado !== 'cancelado' && o.paymentStatus !== 'pagado').reduce((sum, o) => sum + o.total, 0);
        return deudaB - deudaA;
      } else if (sortBy === 'branch_asc') {
        return getBranchName(a.branchId).localeCompare(getBranchName(b.branchId), 'es');
      } else if (sortBy === 'segmento_asc') {
        return a.tipoCliente.localeCompare(b.tipoCliente, 'es');
      }
      return 0;
    });
  }, [clients, search, activeBranchId, selectedBranch, selectedType, selectedActiveStatus, selectedCtaCteStatus, sortBy, orders, branches]);

  const totalClientsCount = filteredAndSortedClients.length;
  const totalPages = Math.ceil(totalClientsCount / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedClients = useMemo(() => {
    const fromIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredAndSortedClients.slice(fromIndex, fromIndex + itemsPerPage);
  }, [filteredAndSortedClients, safeCurrentPage, itemsPerPage]);

  const handleExportClients = () => {
    const dataToExport = filteredAndSortedClients.map(c => ({
      Nombre: c.nombre,
      RazónSocial: c.razonSocial || '',
      CUIT: c.cuit || '',
      Teléfono: c.telefono,
      Email: c.email || '',
      Dirección: c.direccion,
      Sucursal: getBranchName(c.branchId),
      Segmento: c.tipoCliente,
      CtaCte: c.ctaCteAutorizada ? 'Habilitada' : 'No Habilitada',
      LímiteCrédito: c.limiteCredito || 0,
      Estado: c.activo ? 'Activo' : 'Suspendido',
      Observaciones: c.observaciones || '',
    }));

    const fileName = `clientes_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || '';

    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'clientes',
        filtros: { branchId: activeBranchId, search, selectedBranch, selectedType },
        cantidad_registros: dataToExport.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    XLSX.writeFile(workbook, fileName);
  };

  // ─── CÁLCULOS Y HELPER DE CUENTAS CORRIENTES ──────────────────────────────
  const getClientCtaCteDetails = (client: Customer) => {
    const custIdStr = String(client.id);
    const clientOrders = orders.filter(o => 
      String(o.clienteId) === custIdStr && 
      (o.paymentMethod === 'cuenta_corriente' || o.paymentStatus === 'cuenta_corriente' || o.paymentStatus === 'pendiente') &&
      o.estado !== 'cancelado' &&
      o.paymentStatus !== 'pagado' &&
      o.paymentStatus !== 'aprobado'
    );

    const totalDeuda = clientOrders.reduce((sum, o) => sum + o.total, 0);
    const limiteCredito = client.limiteCredito || 0;
    const disponible = Math.max(0, limiteCredito - totalDeuda);
    const esExcedido = limiteCredito > 0 && totalDeuda > limiteCredito;

    return {
      totalDeuda,
      limiteCredito,
      disponible,
      esExcedido,
      ordersCount: clientOrders.length,
      clientOrders
    };
  };

  const ctaCteFilteredClients = useMemo(() => {
    return clients.filter(c => {
      const globalBranchFilter = activeBranchId === 'all' || String(c.branchId) === String(activeBranchId);
      if (!globalBranchFilter) return false;

      const q = ctaCteSearch.toLowerCase();
      const matchesSearch = 
        !q ||
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.razonSocial || '').toLowerCase().includes(q) ||
        (c.cuit || '').includes(q);

      if (!matchesSearch) return false;

      if (ctaCteTab === 'minoristas') {
        return c.tipoCliente === 'minorista' || c.tipoCliente === 'consumidor_final';
      } else if (ctaCteTab === 'mayoristas') {
        return c.tipoCliente === 'mayorista' || c.tipoCliente === 'sucursal';
      } else if (ctaCteTab === 'pendientes') {
        const faltaMayorista = (c.tipoCliente === 'mayorista' || c.tipoCliente === 'sucursal') && !c.mayoristaAutorizado;
        const faltaCtaCte = !c.ctaCteAutorizada;
        return faltaMayorista || faltaCtaCte;
      }

      return true;
    });
  }, [clients, activeBranchId, ctaCteSearch, ctaCteTab]);

  const ctaCteSummary = useMemo(() => {
    let deudaMinoristas = 0;
    let deudaMayoristas = 0;
    let pendientesAutorizacionCount = 0;

    clients.forEach(c => {
      const globalBranchFilter = activeBranchId === 'all' || String(c.branchId) === String(activeBranchId);
      if (!globalBranchFilter) return;

      const { totalDeuda } = getClientCtaCteDetails(c);
      if (c.tipoCliente === 'mayorista' || c.tipoCliente === 'sucursal') {
        deudaMayoristas += totalDeuda;
      } else {
        deudaMinoristas += totalDeuda;
      }

      const faltaMayorista = (c.tipoCliente === 'mayorista' || c.tipoCliente === 'sucursal') && !c.mayoristaAutorizado;
      const faltaCtaCte = !c.ctaCteAutorizada;
      if (faltaMayorista || faltaCtaCte) {
        pendientesAutorizacionCount++;
      }
    });

    return { deudaMinoristas, deudaMayoristas, pendientesAutorizacionCount };
  }, [clients, orders, activeBranchId]);

  const handleToggleCtaCteAuth = async (client: Customer) => {
    try {
      const nextVal = !client.ctaCteAutorizada;
      await updateClient(String(client.id), { ctaCteAutorizada: nextVal });
    } catch (err: any) {
      alert('Error cambiando estado Cta. Cte.: ' + err.message);
    }
  };

  const handleToggleMayoristaAuth = async (client: Customer) => {
    try {
      const nextVal = !client.mayoristaAutorizado;
      await updateClient(String(client.id), { mayoristaAutorizado: nextVal });
    } catch (err: any) {
      alert('Error cambiando estado Mayorista: ' + err.message);
    }
  };

  const handleSaveInlineCreditLimit = async (client: Customer) => {
    try {
      await updateClient(String(client.id), { limiteCredito: editingLimitValue });
      setEditingLimitClientId(null);
    } catch (err: any) {
      alert('Error guardando límite de crédito: ' + err.message);
    }
  };

  return (
    <div className="view-container">
      {/* Selector Pestañas Principales Catálogo & Clientes */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className={`btn ${activeSection === 'directorio' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSection('directorio')}
          style={{ padding: '9px 18px', fontSize: '13.5px', fontWeight: 700, borderRadius: '8px' }}
        >
          👥 Directorio de Clientes
        </button>
        <button
          className={`btn ${activeSection === 'ctaCte' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSection('ctaCte')}
          style={{ padding: '9px 18px', fontSize: '13.5px', fontWeight: 700, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>💳 Cuentas Corrientes & Permisos</span>
          <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
            Opcional
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {activeSection === 'directorio' ? 'Directorio de Clientes' : 'Cuentas Corrientes & Permisos de Crédito'}
            </h1>
            {activeSection === 'ctaCte' && (
              <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📌 MÓDULO ADICIONAL OPCIONAL (COTIZA APARTE)
              </span>
            )}
          </div>
          <p className="page-desc" style={{ marginTop: '4px' }}>
            {activeSection === 'directorio' 
              ? 'Administrar cuentas, perfiles fiscales, asignaciones de sucursal y notas de reparto'
              : 'Control de saldos impagos, asignación de límites de crédito y autorizaciones para Minoristas y Mayoristas'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportClients}>
            📤 Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            ➕ Registrar Cliente
          </button>
        </div>
      </div>
      {/* Renderizado condicional por Pestaña */}
      {activeSection === 'directorio' ? (
        <>
          {/* Controles de Búsqueda, Filtros Multi-Criterio y Ordenamiento */}
          <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="🔍 Buscar por CUIT, Nombre, Razón Social, Dirección o Email..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>

              {activeBranchId === 'all' && (
                <div style={{ width: '160px' }}>
                  <select 
                    className="form-select"
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="all">Todas las sucursales</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ width: '160px' }}>
                <select 
                  className="form-select"
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Todos los segmentos</option>
                  <option value="minorista">Minorista</option>
                  <option value="mayorista">Mayorista</option>
                  <option value="sucursal">Sucursal / Empresa</option>
                </select>
              </div>

              <div style={{ width: '150px' }}>
                <select 
                  className="form-select"
                  value={selectedActiveStatus}
                  onChange={e => setSelectedActiveStatus(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Todos los estados</option>
                  <option value="activo">Solo Activos</option>
                  <option value="suspendido">Solo Suspendidos</option>
                </select>
              </div>

              <div style={{ width: '160px' }}>
                <select 
                  className="form-select"
                  value={selectedCtaCteStatus}
                  onChange={e => setSelectedCtaCteStatus(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">Todas las Cta. Cte.</option>
                  <option value="habilitada">✓ Cta. Cte. Habilitada</option>
                  <option value="no_habilitada">🚫 Sin Cta. Cte.</option>
                </select>
              </div>

              <div style={{ width: '200px' }}>
                <select 
                  className="form-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-color)' }}
                >
                  <option value="fecha_desc">📅 Más recientes primero</option>
                  <option value="fecha_asc">📅 Más antiguos primero</option>
                  <option value="nombre_asc">🔤 Nombre (A - Z)</option>
                  <option value="nombre_desc">🔤 Nombre (Z - A)</option>
                  <option value="razon_asc">🏢 Razón Social (A - Z)</option>
                  <option value="cuit_asc">🔢 CUIT (Menor a Mayor)</option>
                  <option value="egresos_desc">💰 Mayor Egresos / Compras ($)</option>
                  <option value="deuda_desc">💳 Mayor Deuda Cta. Cte. ($)</option>
                  <option value="branch_asc">📍 Sucursal (A - Z)</option>
                  <option value="segmento_asc">🏷️ Segmento Comercial</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabla Principal de Clientes Paginada */}
          <div className="card-wrapper">
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cliente / Razón Social</th>
                    <th>CUIT</th>
                    <th>Contacto</th>
                    <th>Ubicación y Sucursal</th>
                    <th>Segmento & Cta. Cte.</th>
                    <th>Volumen Egresos ($)</th>
                    <th>Saldo Cta. Cte. ($)</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map(c => {
                    const totalEgresos = orders
                      .filter(o => String(o.clienteId) === String(c.id) && o.estado !== 'cancelado')
                      .reduce((sum, o) => sum + o.total, 0);

                    const { totalDeuda } = getClientCtaCteDetails(c);

                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.nombre}</div>
                          {c.razonSocial && c.razonSocial !== c.nombre && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.razonSocial}</div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                          {c.cuit || <span style={{ color: 'var(--text-disabled)' }}>Sin CUIT</span>}
                        </td>
                        <td>
                          <div>📞 {c.telefono}</div>
                          {c.email && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>✉️ {c.email}</div>}
                        </td>
                        <td>
                          <div>{c.direccion}</div>
                          <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold' }}>📍 {getBranchName(c.branchId)}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className={`badge ${
                              c.tipoCliente === 'mayorista' ? 'badge-warning' : 
                              c.tipoCliente === 'sucursal' ? 'badge-primary' : 'badge-neutral'
                            }`}>
                              {c.tipoCliente === 'sucursal' ? 'SUCURSAL' : c.tipoCliente.toUpperCase()}
                            </span>
                            {c.ctaCteAutorizada ? (
                              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>✓ Cta. Cte. OK</span>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>🚫 Sin Cta. Cte.</span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {formatPrice(totalEgresos)}
                        </td>
                        <td style={{ fontWeight: '700', color: totalDeuda > 0 ? 'var(--error-color)' : 'var(--text-primary)' }}>
                          {formatPrice(totalDeuda)}
                        </td>
                        <td>
                          <span className={`badge ${c.activo ? 'badge-success' : 'badge-error'}`}>
                            {c.activo ? 'Activo' : 'Suspendido'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button className="btn btn-secondary" onClick={() => handleOpenEdit(c)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                        Todavía no hay clientes registrados.
                      </td>
                    </tr>
                  ) : totalClientsCount === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                        No se encontraron clientes con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Barra de Paginación Mejorada */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Egresos / Registros por página:</span>
                <select 
                  className="form-select" 
                  style={{ width: '85px', padding: '4px 8px', fontSize: '13px', fontWeight: 'bold' }}
                  value={itemsPerPage}
                  onChange={e => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span style={{ marginLeft: '12px' }}>
                  Mostrando {totalClientsCount === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1} - {Math.min(safeCurrentPage * itemsPerPage, totalClientsCount)} de {totalClientsCount.toLocaleString('es-AR')} clientes
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                >
                  « Primero
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  ‹ Anterior
                </button>
                
                <span style={{ fontSize: '13px', fontWeight: 700, padding: '0 10px', color: 'var(--primary-color)' }}>
                  Página {safeCurrentPage} de {totalPages}
                </span>

                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Siguiente ›
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  Último »
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* 💳 SECCIÓN DE CUENTAS CORRIENTES Y AUTORIZACIONES DE CRÉDITO */
        <ExtraModuleWrapper title="Módulo de Cuentas Corrientes y Permisos" description="La gestión de cuentas corrientes, saldos adeudados, límites de crédito y autorizaciones de pago aplazado se encuentra contemplada como módulo adicional opcional.">
          <div className="card-wrapper" style={{ marginTop: '0', borderTop: '3px solid #0284c7' }}>
          <div className="card-header" style={{ padding: '20px 24px', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>💳 Cuentas Corrientes y Permisos de Crédito</span>
                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📌 MÓDULO ADICIONAL OPCIONAL (COTIZA APARTE)
                </span>
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Gestión de saldos, límites de crédito y autorizaciones previa del Administrador para clientes Minoristas y Mayoristas/Distribuidores.
              </p>
            </div>
          </div>

        {/* Tarjetas Resumidas de Deuda */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '20px 24px', backgroundColor: 'rgba(2, 132, 199, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: '#fff', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Deuda Cta. Cte. Minoristas</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
              {formatPrice(ctaCteSummary.deudaMinoristas)}
            </div>
          </div>
          <div style={{ background: '#fff', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Deuda Cta. Cte. Mayoristas</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
              {formatPrice(ctaCteSummary.deudaMayoristas)}
            </div>
          </div>
          <div style={{ background: '#fff', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Solicitudes Pendientes</span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: ctaCteSummary.pendientesAutorizacionCount > 0 ? '#ea580c' : '#10b981', marginTop: '4px' }}>
              {ctaCteSummary.pendientesAutorizacionCount} pendientes
            </div>
          </div>
        </div>

        {/* Sub-Pestañas e Ingreso de Búsqueda */}
        <div style={{ padding: '16px 24px 0 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`date-filter-btn ${ctaCteTab === 'minoristas' ? 'active' : ''}`}
              onClick={() => setCtaCteTab('minoristas')}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700 }}
            >
              🛒 Minoristas Cta. Cte.
            </button>
            <button
              className={`date-filter-btn ${ctaCteTab === 'mayoristas' ? 'active' : ''}`}
              onClick={() => setCtaCteTab('mayoristas')}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700 }}
            >
              🏢 Mayoristas & Distribuidores
            </button>
            <button
              className={`date-filter-btn ${ctaCteTab === 'pendientes' ? 'active' : ''}`}
              onClick={() => setCtaCteTab('pendientes')}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, position: 'relative' }}
            >
              ⏳ Pendientes ({ctaCteSummary.pendientesAutorizacionCount})
            </button>
          </div>

          <div style={{ width: '220px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="🔍 Buscar cliente / CUIT..."
              value={ctaCteSearch}
              onChange={e => setCtaCteSearch(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Tabla de Cuentas Corrientes y Autorizaciones */}
        <div className="table-container" style={{ padding: '16px 24px 24px 24px' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cliente / Razón Social</th>
                <th>Segmento</th>
                <th>Estado Cta. Cte.</th>
                <th>Permiso Mayorista</th>
                <th>Saldo Deuda Actual</th>
                <th>Límite de Crédito</th>
                <th>Crédito Disponible</th>
                <th className="text-right">Acción / Habilitaciones</th>
              </tr>
            </thead>
            <tbody>
              {ctaCteFilteredClients.map(c => {
                const { totalDeuda, limiteCredito, disponible, esExcedido, ordersCount } = getClientCtaCteDetails(c);
                const isEditingLimit = editingLimitClientId === c.id;
                const esMayorista = c.tipoCliente === 'mayorista' || c.tipoCliente === 'sucursal';

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.nombre}</div>
                      {c.razonSocial && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.razonSocial}</div>}
                      <div style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>CUIT: {c.cuit || 'Sin CUIT'}</div>
                    </td>
                    <td>
                      <span className={`badge ${esMayorista ? 'badge-warning' : 'badge-neutral'}`}>
                        {c.tipoCliente.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {c.ctaCteAutorizada ? (
                        <span className="badge badge-success">✓ Cta. Cte. Habilitada</span>
                      ) : (
                        <span className="badge badge-error">🚫 Sin Permiso Cta. Cte.</span>
                      )}
                    </td>
                    <td>
                      {esMayorista ? (
                        c.mayoristaAutorizado ? (
                          <span className="badge badge-success">✓ Mayorista Aprobado</span>
                        ) : (
                          <span className="badge badge-warning">⏳ Mayorista Pendiente</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-disabled)', fontSize: '12px' }}>N/A (Minorista)</span>
                      )}
                    </td>
                    <td style={{ fontWeight: '700', color: totalDeuda > 0 ? 'var(--error-color)' : 'var(--text-primary)' }}>
                      {formatPrice(totalDeuda)}
                      {ordersCount > 0 && (
                        <button
                          onClick={() => setInspectingOrdersClient(c)}
                          style={{ display: 'block', border: 'none', background: 'none', color: '#0284c7', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', marginTop: '2px', padding: 0 }}
                        >
                          Ver {ordersCount} pedido(s) impagos
                        </button>
                      )}
                    </td>
                    <td>
                      {isEditingLimit ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: '100px', padding: '4px 8px', fontSize: '12px' }}
                            value={editingLimitValue}
                            onChange={e => setEditingLimitValue(Number(e.target.value))}
                          />
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleSaveInlineCreditLimit(c)}>
                            ✓
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setEditingLimitClientId(null)}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{formatPrice(limiteCredito)}</span>
                          <button
                            onClick={() => {
                              setEditingLimitClientId(c.id);
                              setEditingLimitValue(limiteCredito);
                            }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}
                            title="Editar Límite de Crédito"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: '600', color: esExcedido ? 'var(--error-color)' : '#10b981' }}>
                      {formatPrice(disponible)}
                      {esExcedido && <div style={{ fontSize: '10px', color: 'var(--error-color)', fontWeight: 'bold' }}>⚠️ Límite Excedido</div>}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button 
                          className={`btn ${c.ctaCteAutorizada ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                          onClick={() => handleToggleCtaCteAuth(c)}
                        >
                          {c.ctaCteAutorizada ? '🚫 Revocar Cta. Cte.' : '✅ Autorizar Cta. Cte.'}
                        </button>

                        {esMayorista && (
                          <button 
                            className={`btn ${c.mayoristaAutorizado ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '5px 10px', fontSize: '11px', backgroundColor: c.mayoristaAutorizado ? undefined : '#7c3aed', color: '#fff' }}
                            onClick={() => handleToggleMayoristaAuth(c)}
                          >
                            {c.mayoristaAutorizado ? '🔒 Suspender Mayorista' : '⭐ Aprobar Mayorista'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {ctaCteFilteredClients.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-disabled)' }}>
                    No hay registros de cuentas corrientes en esta categoría.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </ExtraModuleWrapper>
      )}

      {/* Modal Inspección de Pedidos Impagos en Cta. Cte. */}
      {inspectingOrdersClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2 className="card-title">Pedidos Impagos Cta. Cte.: {inspectingOrdersClient.nombre}</h2>
              <button type="button" className="btn-close" onClick={() => setInspectingOrdersClient(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {getClientCtaCteDetails(inspectingOrdersClient).clientOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{o.numero} - {new Date(o.fecha).toLocaleDateString('es-AR')}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Estado: {o.estado} | Método: {o.paymentMethod}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>
                    {formatPrice(o.total)}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setInspectingOrdersClient(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {editingClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-header">
                <h2 className="card-title">Editar Cliente: {editingClient.nombre}</h2>
                <button type="button" className="btn-close" onClick={() => setEditingClient(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Comercial / Titular</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.nombre}
                      onChange={e => setFormClient({ ...formClient, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Razón Social (Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.razonSocial}
                      onChange={e => setFormClient({ ...formClient, razonSocial: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">CUIT (sólo números, Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.cuit}
                      onChange={e => setFormClient({ ...formClient, cuit: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono de contacto</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.telefono}
                      onChange={e => setFormClient({ ...formClient, telefono: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Email (Opcional)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={formClient.email}
                      onChange={e => setFormClient({ ...formClient, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>

                  <label className="form-label" style={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📍 Dirección de Entrega y Ubicación en Mapa (Confirmar Pin)
                  </label>
                  <AddressLocationPicker
                    initialAddress={{
                      formattedAddress: formClient.direccion,
                      latitude: formClient.latitude,
                      longitude: formClient.longitude,
                    }}
                    onAddressSelect={(geo) => {
                      setFormClient(prev => ({
                        ...prev,
                        direccion: geo.formattedAddress,
                        latitude: geo.latitude,
                        longitude: geo.longitude,
                      }));
                    }}
                  />
                </div>


                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sucursal de Atención</label>
                    <select 
                      className="form-select"
                      value={formClient.branchId}
                      onChange={e => setFormClient({ ...formClient, branchId: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Segmento Comercial</label>
                    <select 
                      className="form-select"
                      value={formClient.tipoCliente}
                      onChange={e => setFormClient({ ...formClient, tipoCliente: e.target.value as ClientType })}
                    >
                      <option value="minorista">Minorista (Consumidor Final)</option>
                      <option value="mayorista">Mayorista (Precios diferenciados)</option>
                      <option value="sucursal">Sucursal / Empresa</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado de la Cuenta</label>
                    <select 
                      className="form-select"
                      value={formClient.activo ? 'true' : 'false'}
                      onChange={e => setFormClient({ ...formClient, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activo / Habilitado</option>
                      <option value="false">Suspendido / En Mora</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas Especiales de Despacho / Observaciones</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '80px', fontFamily: 'sans-serif' }}
                    placeholder="Instrucciones para el repartidor (Ej: Entrar por calle lateral, el timbre no funciona)"
                    value={formClient.observaciones}
                    onChange={e => setFormClient({ ...formClient, observaciones: e.target.value })}
                  />
                </div>

                {/* Permisos de Cuenta Corriente y Mayorista */}
                <div style={{ marginTop: '16px', padding: '14px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    💳 Permisos y Autorizaciones de Crédito
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                        <input 
                          type="checkbox"
                          checked={formClient.ctaCteAutorizada}
                          onChange={e => setFormClient({ ...formClient, ctaCteAutorizada: e.target.checked })}
                        />
                        <span>Habilitar Cuenta Corriente</span>
                      </label>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Límite de Crédito ($)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="Ej: 50000"
                        value={formClient.limiteCredito}
                        onChange={e => setFormClient({ ...formClient, limiteCredito: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {(formClient.tipoCliente === 'mayorista' || formClient.tipoCliente === 'sucursal') && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#7c3aed', fontWeight: 600 }}>
                        <input 
                          type="checkbox"
                          checked={formClient.mayoristaAutorizado}
                          onChange={e => setFormClient({ ...formClient, mayoristaAutorizado: e.target.checked })}
                        />
                        <span>Autorizar Perfil Mayorista / Distribuidor</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Seccion de Direcciones Adicionales del Cliente */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🏠 Direcciones Secundarias / Alternativas ({clientAddresses.length})
                    </label>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => setShowAddAddress(!showAddAddress)}
                    >
                      {showAddAddress ? '✕ Cancelar' : '➕ Agregar Otra Dirección'}
                    </button>
                  </div>

                  {/* Formulario para Agregar Nueva Dirección */}
                  {showAddAddress && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#0284c7' }}>
                        Nueva Dirección Auxiliar
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ej: Bv. Pueyrredón 552, Depósito 2"
                          value={newAddrText}
                          onChange={e => setNewAddrText(e.target.value)}
                        />
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Indicaciones / Referencias (Opcional)"
                        value={newAddrIndicaciones}
                        onChange={e => setNewAddrIndicaciones(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        disabled={addingAddr || !newAddrText.trim()}
                        onClick={handleAddAuxAddress}
                      >
                        {addingAddr ? 'Guardando...' : '💾 Guardar Dirección'}
                      </button>
                    </div>
                  )}

                  {/* Lista de Direcciones Auxiliares Existentes */}
                  {loadingAddresses ? (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Cargando direcciones...</div>
                  ) : clientAddresses.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Este cliente no posee direcciones adicionales registradas.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {clientAddresses.map(addr => (
                        <div key={addr.id} style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          {editingAddressId === addr.id ? (
                            <div>
                              <div style={{ marginBottom: '6px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={editAddrText}
                                  onChange={e => setEditAddrText(e.target.value)}
                                />
                              </div>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Indicaciones"
                                value={editAddrIndicaciones}
                                onChange={e => setEditAddrIndicaciones(e.target.value)}
                                style={{ marginBottom: '6px' }}
                              />
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => addr.id && handleSaveAuxAddress(String(addr.id))}
                                >
                                  💾 Guardar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => setEditingAddressId(null)}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                                  📍 {addr.direccion}
                                </div>
                                {addr.indicaciones ? (
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    Ref: {addr.indicaciones}
                                  </div>
                                ) : null}
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => handleStartEditAuxAddr(addr)}
                                >
                                  ✏️ Modificar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ padding: '3px 8px', fontSize: '11px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px' }}
                                  onClick={() => addr.id && handleDeleteAuxAddress(String(addr.id))}
                                >
                                  🗑️ Eliminar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingClient(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Cliente */}
      {isCreating && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <form onSubmit={handleSaveCreate}>
              <div className="modal-header">
                <h2 className="card-title">Registrar Nuevo Cliente</h2>
                <button type="button" className="btn-close" onClick={() => setIsCreating(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Comercial / Titular</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Marcelo Gómez"
                      value={formClient.nombre}
                      onChange={e => setFormClient({ ...formClient, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Razón Social (Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Distribuidora Sol S.A."
                      value={formClient.razonSocial}
                      onChange={e => setFormClient({ ...formClient, razonSocial: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">CUIT (sólo números, Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 30123456789"
                      value={formClient.cuit}
                      onChange={e => setFormClient({ ...formClient, cuit: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono de contacto</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 3584123456"
                      value={formClient.telefono}
                      onChange={e => setFormClient({ ...formClient, telefono: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Email (Opcional)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="ejemplo@correo.com"
                      value={formClient.email}
                      onChange={e => setFormClient({ ...formClient, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>

                  <label className="form-label" style={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📍 Dirección de Entrega y Ubicación en Mapa (Confirmar Pin)
                  </label>
                  <AddressLocationPicker
                    initialAddress={{
                      formattedAddress: formClient.direccion,
                      latitude: formClient.latitude,
                      longitude: formClient.longitude,
                    }}
                    onAddressSelect={(geo) => {
                      setFormClient(prev => ({
                        ...prev,
                        direccion: geo.formattedAddress,
                        latitude: geo.latitude,
                        longitude: geo.longitude,
                      }));
                    }}
                  />
                </div>


                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sucursal de Atención</label>
                    <select 
                      className="form-select"
                      value={formClient.branchId}
                      onChange={e => setFormClient({ ...formClient, branchId: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Segmento Comercial</label>
                    <select 
                      className="form-select"
                      value={formClient.tipoCliente}
                      onChange={e => setFormClient({ ...formClient, tipoCliente: e.target.value as ClientType })}
                    >
                      <option value="minorista">Minorista (Consumidor Final)</option>
                      <option value="mayorista">Mayorista (Precios diferenciados)</option>
                      <option value="sucursal">Sucursal / Empresa</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas Especiales / Observaciones</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '80px', fontFamily: 'sans-serif' }}
                    placeholder="Instrucciones del chofer al entregar."
                    value={formClient.observaciones}
                    onChange={e => setFormClient({ ...formClient, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
