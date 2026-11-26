import { useState, useEffect, useMemo, useCallback } from 'react';
import { BranchLocation } from '../types';
import { subscribeToFirestoreBranches } from '../services/firebase';
import {
  getConfiguredBranchList,
  getConfiguredBranchNames,
  resolveConfiguredBranchName,
} from './rrhhBranches';

function readCachedBranches(): BranchLocation[] {
  try {
    const saved = localStorage.getItem('pampero_catalog_branches');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

export function useConfiguredBranches(propBranches?: BranchLocation[]) {
  const [rawBranches, setRawBranches] = useState<BranchLocation[]>(() => {
    if (Array.isArray(propBranches) && propBranches.length > 0) return propBranches;
    return readCachedBranches();
  });

  useEffect(() => {
    if (Array.isArray(propBranches) && propBranches.length > 0) {
      setRawBranches(propBranches);
    }
  }, [propBranches]);

  useEffect(() => {
    const unsub = subscribeToFirestoreBranches((remote) => {
      if (Array.isArray(remote) && remote.length > 0) {
        setRawBranches(remote);
      }
    });
    return () => unsub();
  }, []);

  const branches = useMemo(() => getConfiguredBranchList(rawBranches), [rawBranches]);
  const branchNames = useMemo(() => getConfiguredBranchNames(branches), [branches]);

  const resolveBranch = useCallback(
    (rawName: string | undefined, allowTodas = true) =>
      resolveConfiguredBranchName(rawName, branches, allowTodas),
    [branches]
  );

  return { branches, branchNames, resolveBranch };
}
