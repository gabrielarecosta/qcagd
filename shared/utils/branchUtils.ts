import { Branch } from '../types/branch';

export function getBranchName(branchId?: string | number, branches: Branch[] = []): string {
  if (!branchId) return 'Administración General';
  const branch = branches.find(b => String(b.id) === String(branchId));
  return branch ? branch.nombre : (String(branchId) === '1' || branchId === 1 ? 'Sucursal Central (GD)' : 'Sucursal General');
}
