import { Branch } from '../types/branch';

export const DEFAULT_SUCURSAL_CENTRAL = {
  name: 'SUCURSAL CENTRAL QGD',
  address: 'Entre Ríos 151, General Deheza, Córdoba, Argentina',
  latitude: -32.7650,
  longitude: -63.7860,
};

export function getCentralBranchInfo(branches: Branch[]) {
  if (!branches || branches.length === 0) return DEFAULT_SUCURSAL_CENTRAL;

  const central = branches.find(b => 
    b.id === 1 || 
    String(b.id) === '1' || 
    b.nombre.toLowerCase().includes('central') || 
    b.nombre.toLowerCase().includes('deheza 1')
  );

  if (central && central.direccion) {
    return {
      name: central.nombre || 'SUCURSAL CENTRAL QGD',
      address: central.direccion,
      latitude: central.latitude ?? -32.7650,
      longitude: central.longitude ?? -63.7860,
      telefono: central.telefono || '',
      whatsapp: central.whatsapp || '',
      horarioAtencion: central.horarioAtencion || '',
    };
  }

  return DEFAULT_SUCURSAL_CENTRAL;
}
