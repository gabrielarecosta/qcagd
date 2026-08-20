// Deprecated service - sectors removed
import { Sector } from '../types/sector';

export const sectorService = {
  getAll: async (): Promise<Sector[]> => [],
  getByBranchId: async (_branchId: string): Promise<Sector[]> => [],
  getById: async (_id: string): Promise<Sector | undefined> => undefined,
  update: async (_id: string, _updates: Partial<Sector>): Promise<Sector> => ({ id: _id, nombre: '', branchId: '' }),
  create: async (_sector: Omit<Sector, 'id'>): Promise<Sector> => ({ id: 'deprecated', nombre: '', branchId: '' }),
  delete: async (_id: string): Promise<boolean> => true,
};
