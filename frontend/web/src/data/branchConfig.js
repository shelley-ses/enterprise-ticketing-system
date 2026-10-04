/**
 * Branch Configuration & Mock Data (TS090, TS092, TS097)
 *
 * Reusable list of placeholder physical branches / hospital locations.
 *
 * NOTE: This is local mock state for the current sprint. Real branch records,
 * backend associations, and multi-tenant permissions need to come from backend
 * API / database migrations and business requirements in a future sprint.
 */

export const BRANCH_STORAGE_KEY = 'superadmin_active_branch';

export const DEFAULT_BRANCHES = [
  {
    id: 'main',
    name: 'Main Branch',
    code: 'MAIN',
    region: 'NCR',
    description: 'Primary medical facility & headquarters (Metro Manila)',
  },
  {
    id: 'luzon',
    name: 'Luzon Regional Center',
    code: 'LUZ',
    region: 'Luzon',
    description: 'Northern & Central Luzon healthcare service hub',
  },
  {
    id: 'visayas',
    name: 'Visayas Medical Hub',
    code: 'VIS',
    region: 'Visayas',
    description: 'Cebu and Central Visayas regional hospital center',
  },
  {
    id: 'mindanao',
    name: 'Mindanao Regional Branch',
    code: 'MIN',
    region: 'Mindanao',
    description: 'Davao and Southern Mindanao health service facility',
  },
];

export const DEFAULT_BRANCH_ID = 'main';

/**
 * Retrieve the currently stored active branch ID from localStorage,
 * falling back to DEFAULT_BRANCH_ID if missing or invalid.
 */
export function getStoredBranchId() {
  try {
    const stored = localStorage.getItem(BRANCH_STORAGE_KEY);
    if (stored && DEFAULT_BRANCHES.some((b) => b.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore localStorage access failures (SSR / private mode)
  }
  return DEFAULT_BRANCH_ID;
}

/**
 * Persist the selected branch ID to localStorage and broadcast an event.
 */
export function setStoredBranchId(branchId) {
  try {
    if (DEFAULT_BRANCHES.some((b) => b.id === branchId)) {
      localStorage.setItem(BRANCH_STORAGE_KEY, branchId);
      window.dispatchEvent(new CustomEvent('active_branch_changed', { detail: { branchId } }));
      return true;
    }
  } catch {
    // Ignore localStorage access failures
  }
  return false;
}
