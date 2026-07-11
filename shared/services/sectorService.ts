import { supabase } from './supabaseClient';
import { Sector } from '../types/sector';

const mapSector = (d: any): Sector => ({
  id: d.id,
  branchId: d.branch_id,
  nombre: d.nombre,
  descripcion: d.descripcion || '',
  activo: d.activo,
});

export const sectorService = {
  getAll: async (): Promise<Sector[]> => {
    const { data, error } = await supabase
      .from('sectors')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapSector);
  },

  getByBranchId: async (branchId: string): Promise<Sector[]> => {
    const { data, error } = await supabase
      .from('sectors')
      .select('*')
      .eq('branch_id', branchId)
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapSector);
  },

  update: async (id: string, updates: Partial<Sector>): Promise<Sector> => {
    const dbUpdates: any = {
      nombre: updates.nombre,
      descripcion: updates.descripcion,
      branch_id: updates.branchId,
      activo: updates.activo,
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('sectors')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapSector(data);
  },

  create: async (sector: Omit<Sector, 'id'>): Promise<Sector> => {
    const sectorId = `sector-${Date.now()}`;
    const dbInsert = {
      id: sectorId,
      branch_id: sector.branchId,
      nombre: sector.nombre,
      descripcion: sector.descripcion,
      activo: sector.activo ?? true,
    };

    const { data, error } = await supabase
      .from('sectors')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;
    return mapSector(data);
  }
};
