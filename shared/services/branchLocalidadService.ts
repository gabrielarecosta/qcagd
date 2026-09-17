import { supabase } from './supabaseClient';

export interface BranchLocalidadLink {
  id: string;
  branchId: number;
  localidadId: string;
  esPrincipal: boolean;
}

export const branchLocalidadService = {
  getAllLinks: async (): Promise<BranchLocalidadLink[]> => {
    try {
      const { data, error } = await supabase
        .from('branch_localidades')
        .select('*');
      if (error) {
        console.warn('Error fetching branch_localidades:', error.message);
        return [];
      }
      return (data || []).map((d: any) => ({
        id: d.id,
        branchId: Number(d.branch_id),
        localidadId: String(d.localidad_id),
        esPrincipal: d.es_principal ?? false,
      }));
    } catch (e) {
      console.warn('Error in branchLocalidadService.getAllLinks:', e);
      return [];
    }
  },

  getBranchesForLocalidad: async (localidadId: string): Promise<number[]> => {
    try {
      const { data, error } = await supabase
        .from('branch_localidades')
        .select('branch_id')
        .eq('localidad_id', localidadId);
      if (error) return [];
      return (data || []).map((d: any) => Number(d.branch_id));
    } catch (e) {
      return [];
    }
  },

  getLocalidadesForBranch: async (branchId: number | string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('branch_localidades')
        .select('localidad_id')
        .eq('branch_id', branchId);
      if (error) return [];
      return (data || []).map((d: any) => String(d.localidad_id));
    } catch (e) {
      return [];
    }
  },

  setLocalidadesForBranch: async (branchId: number | string, localidadIds: string[]): Promise<void> => {
    try {
      await supabase.from('branch_localidades').delete().eq('branch_id', branchId);

      if (localidadIds.length > 0) {
        const rows = localidadIds.map((locId, idx) => ({
          branch_id: Number(branchId),
          localidad_id: locId,
          es_principal: idx === 0,
        }));
        await supabase.from('branch_localidades').insert(rows);
      }
    } catch (e) {
      console.warn('Error setting localidades for branch:', e);
    }
  },

  setBranchesForLocalidad: async (localidadId: string, branchIds: (number | string)[]): Promise<void> => {
    try {
      await supabase.from('branch_localidades').delete().eq('localidad_id', localidadId);

      if (branchIds.length > 0) {
        const rows = branchIds.map((bId, idx) => ({
          branch_id: Number(bId),
          localidad_id: localidadId,
          es_principal: idx === 0,
        }));
        await supabase.from('branch_localidades').insert(rows);
      }
    } catch (e) {
      console.warn('Error setting branches for localidad:', e);
    }
  },
};
