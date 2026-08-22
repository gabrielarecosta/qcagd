import { Branch } from '../types/branch';

export function getBranchName(branchId?: string | number, branches: Branch[] = []): string {
  if (!branchId) return 'Administración General';
  const branch = branches.find(b => String(b.id) === String(branchId));
  return branch ? branch.nombre : (String(branchId) === '1' || branchId === 1 ? 'Sucursal Central (GD)' : 'Sucursal General');
}

export function parseBranchId(branchId?: string | number | null): number | undefined {
  if (branchId === null || branchId === undefined || branchId === 'all' || branchId === '') return undefined;
  if (typeof branchId === 'number') return isNaN(branchId) ? undefined : branchId;
  
  const str = String(branchId).trim();
  if (str === 'branch-gd1') return 1;
  if (str === 'branch-gd2') return 2;
  if (str === 'branch-rc') return 3;
  if (str === 'branch-gig') return 4;

  const parsed = parseInt(str, 10);
  return !isNaN(parsed) ? parsed : undefined;
}
