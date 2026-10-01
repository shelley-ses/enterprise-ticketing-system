/**
 * Branch-Specific Priority Levels & SLA Overrides Configuration (TS092)
 *
 * Manages physical branch overrides for system-wide ticket priorities and SLA targets.
 *
 * NOTE: This is local mock state for the current sprint. Real branch records,
 * backend associations, and multi-tenant permissions need to come from backend
 * API / database migrations and business requirements in a future sprint.
 */

export const BRANCH_PRIORITIES_STORAGE_KEY = 'superadmin_branch_priority_overrides';

// System-wide default SLA values from TS091 / department baseline
export const SYSTEM_DEFAULT_PRIORITY_SLAS = {
  Critical: { responseTimeLimit: 15, resolutionTimeLimit: 240 },
  High: { responseTimeLimit: 30, resolutionTimeLimit: 480 },
  Medium: { responseTimeLimit: 120, resolutionTimeLimit: 1440 },
  Low: { responseTimeLimit: 240, resolutionTimeLimit: 4320 },
};

/**
 * Seed initial branch overrides.
 * Per TS092 specification:
 * - One example override is seeded as inUse: true, activeTicketCount: 3 to demonstrate blocked removal.
 * - Another override is seeded as inUse: false, activeTicketCount: 0 to demonstrate successful removal.
 */
// SIMULATED: no real branch-tagged ticket data exists yet. Replace inUse/activeTicketCount with a real query once tickets support branch tagging.
export const INITIAL_BRANCH_PRIORITY_OVERRIDES = {
  luzon: [
    {
      id: 'branch-luzon-p4',
      basePriorityId: 4,
      branchId: 'luzon',
      name: 'Critical',
      color: 'bg-red-100 text-red-700',
      responseTimeLimit: 10,
      resolutionTimeLimit: 120,
      isInherited: false,
      inUse: true, // SIMULATED: blocked removal demonstration
      activeTicketCount: 3,
    },
    {
      id: 'branch-luzon-p3',
      basePriorityId: 3,
      branchId: 'luzon',
      name: 'High',
      color: 'bg-orange-100 text-orange-700',
      responseTimeLimit: 25,
      resolutionTimeLimit: 360,
      isInherited: false,
      inUse: false, // SIMULATED: successful removal demonstration
      activeTicketCount: 0,
    },
    {
      id: 'branch-luzon-p2',
      basePriorityId: 2,
      branchId: 'luzon',
      name: 'Medium',
      color: 'bg-yellow-100 text-yellow-700',
      responseTimeLimit: 120,
      resolutionTimeLimit: 1440,
      isInherited: true, // Using system-wide default
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-luzon-p1',
      basePriorityId: 1,
      branchId: 'luzon',
      name: 'Low',
      color: 'bg-green-100 text-green-700',
      responseTimeLimit: 240,
      resolutionTimeLimit: 4320,
      isInherited: true, // Using system-wide default
      inUse: false,
      activeTicketCount: 0,
    },
  ],
  main: [
    {
      id: 'branch-main-p4',
      basePriorityId: 4,
      branchId: 'main',
      name: 'Critical',
      color: 'bg-red-100 text-red-700',
      responseTimeLimit: 15,
      resolutionTimeLimit: 240,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-main-p3',
      basePriorityId: 3,
      branchId: 'main',
      name: 'High',
      color: 'bg-orange-100 text-orange-700',
      responseTimeLimit: 30,
      resolutionTimeLimit: 480,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-main-p2',
      basePriorityId: 2,
      branchId: 'main',
      name: 'Medium',
      color: 'bg-yellow-100 text-yellow-700',
      responseTimeLimit: 120,
      resolutionTimeLimit: 1440,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-main-p1',
      basePriorityId: 1,
      branchId: 'main',
      name: 'Low',
      color: 'bg-green-100 text-green-700',
      responseTimeLimit: 240,
      resolutionTimeLimit: 4320,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
  ],
  visayas: [
    {
      id: 'branch-visayas-p4',
      basePriorityId: 4,
      branchId: 'visayas',
      name: 'Critical',
      color: 'bg-red-100 text-red-700',
      responseTimeLimit: 15,
      resolutionTimeLimit: 240,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-visayas-p3',
      basePriorityId: 3,
      branchId: 'visayas',
      name: 'High',
      color: 'bg-orange-100 text-orange-700',
      responseTimeLimit: 30,
      resolutionTimeLimit: 480,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-visayas-p2',
      basePriorityId: 2,
      branchId: 'visayas',
      name: 'Medium',
      color: 'bg-yellow-100 text-yellow-700',
      responseTimeLimit: 120,
      resolutionTimeLimit: 1440,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-visayas-p1',
      basePriorityId: 1,
      branchId: 'visayas',
      name: 'Low',
      color: 'bg-green-100 text-green-700',
      responseTimeLimit: 240,
      resolutionTimeLimit: 4320,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
  ],
  mindanao: [
    {
      id: 'branch-mindanao-p4',
      basePriorityId: 4,
      branchId: 'mindanao',
      name: 'Critical',
      color: 'bg-red-100 text-red-700',
      responseTimeLimit: 15,
      resolutionTimeLimit: 240,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-mindanao-p3',
      basePriorityId: 3,
      branchId: 'mindanao',
      name: 'High',
      color: 'bg-orange-100 text-orange-700',
      responseTimeLimit: 30,
      resolutionTimeLimit: 480,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-mindanao-p2',
      basePriorityId: 2,
      branchId: 'mindanao',
      name: 'Medium',
      color: 'bg-yellow-100 text-yellow-700',
      responseTimeLimit: 120,
      resolutionTimeLimit: 1440,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
    {
      id: 'branch-mindanao-p1',
      basePriorityId: 1,
      branchId: 'mindanao',
      name: 'Low',
      color: 'bg-green-100 text-green-700',
      responseTimeLimit: 240,
      resolutionTimeLimit: 4320,
      isInherited: true,
      inUse: false,
      activeTicketCount: 0,
    },
  ],
};

/**
 * Retrieve branch overrides from localStorage or fall back to defaults.
 */
export function getStoredBranchOverrides() {
  try {
    const raw = localStorage.getItem(BRANCH_PRIORITIES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse errors
  }
  return INITIAL_BRANCH_PRIORITY_OVERRIDES;
}

/**
 * Persist branch overrides to localStorage.
 */
export function setStoredBranchOverrides(overrides) {
  try {
    localStorage.setItem(BRANCH_PRIORITIES_STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    return false;
  }
}
