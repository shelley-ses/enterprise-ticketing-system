import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  DEFAULT_BRANCHES,
  DEFAULT_BRANCH_ID,
  getStoredBranchId,
  setStoredBranchId,
} from '@/data/branchConfig';

const BranchContext = createContext(null);

/**
 * BranchProvider manages the globally selected physical branch / facility.
 * Persists the Super Admin's selection across page reloads and cross-tab actions.
 */
export function BranchProvider({ children }) {
  const [selectedBranchId, setSelectedBranchIdState] = useState(getStoredBranchId);

  // Sync state when changed internally or via custom event / other tabs
  useEffect(() => {
    const handleCustomChange = (e) => {
      const nextId = e.detail?.branchId;
      if (nextId && DEFAULT_BRANCHES.some((b) => b.id === nextId)) {
        setSelectedBranchIdState(nextId);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'superadmin_active_branch' && e.newValue) {
        if (DEFAULT_BRANCHES.some((b) => b.id === e.newValue)) {
          setSelectedBranchIdState(e.newValue);
        }
      }
    };

    window.addEventListener('active_branch_changed', handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('active_branch_changed', handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setSelectedBranchId = useCallback((branchId) => {
    if (DEFAULT_BRANCHES.some((b) => b.id === branchId)) {
      setSelectedBranchIdState(branchId);
      setStoredBranchId(branchId);
    }
  }, []);

  const setSelectedBranch = useCallback((branchOrId) => {
    const id = typeof branchOrId === 'string' ? branchOrId : branchOrId?.id;
    if (id) {
      setSelectedBranchId(id);
    }
  }, [setSelectedBranchId]);

  const selectedBranch = useMemo(() => {
    return DEFAULT_BRANCHES.find((b) => b.id === selectedBranchId) || DEFAULT_BRANCHES[0];
  }, [selectedBranchId]);

  const value = useMemo(() => ({
    branches: DEFAULT_BRANCHES,
    selectedBranchId,
    selectedBranch,
    setSelectedBranchId,
    setSelectedBranch,
  }), [selectedBranchId, selectedBranch, setSelectedBranchId, setSelectedBranch]);

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

/**
 * Custom hook to access active branch state in any component.
 */
export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a <BranchProvider>');
  }
  return context;
}

export default BranchContext;
