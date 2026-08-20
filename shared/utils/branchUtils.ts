import { Branch } from '../types/branch';

export function getBranchName(branchId?: string, branches: Branch[] = []): string {
  if (!branchId) return 'Administración General';
  const branch = branches.find(b => b.id === branchId);
  return branch ? branch.nombre : (branchId === 'branch-gd1' ? 'Sucursal Central (GD)' : 'Sucursal General');
}
