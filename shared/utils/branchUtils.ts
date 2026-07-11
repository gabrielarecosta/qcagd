import { mockBranches } from '../data/mockBranches';

export function getBranchName(branchId?: string): string {
  if (!branchId) return 'Administración General';
  const branch = mockBranches.find(b => b.id === branchId);
  return branch ? branch.nombre : 'Sucursal Desconocida';
}
