import { useCallback, useEffect, useMemo, useState } from 'react';
import { newBudget, normalizeBudget } from './lib/budget';
import { caliperExample } from './lib/examples';
import type { Budget } from './lib/types';

const LIB_KEY = 'ubc.budgets.v1';
const CUR_KEY = 'ubc.current.v1';

function readLibrary(): Record<string, Budget> {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Budget> = {};
    for (const [k, v] of Object.entries(obj)) {
      try { out[k] = normalizeBudget(v); } catch { /* skip corrupt entry */ }
    }
    return out;
  } catch {
    return {};
  }
}

function readCurrent(): Budget {
  try {
    const raw = localStorage.getItem(CUR_KEY);
    if (raw) return normalizeBudget(JSON.parse(raw));
  } catch { /* fall through */ }
  return caliperExample();
}

export function useBudgetStore() {
  const [budget, setBudgetState] = useState<Budget>(readCurrent);
  const [library, setLibrary] = useState<Record<string, Budget>>(readLibrary);

  // autosave the working budget
  useEffect(() => {
    try { localStorage.setItem(CUR_KEY, JSON.stringify(budget)); } catch { /* quota */ }
  }, [budget]);
  useEffect(() => {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(library)); } catch { /* quota */ }
  }, [library]);

  const update = useCallback((fn: (b: Budget) => Budget) => {
    setBudgetState((b) => ({ ...fn(b), updatedAt: new Date().toISOString() }));
  }, []);

  const replace = useCallback((b: Budget) => setBudgetState(b), []);

  const saveToLibrary = useCallback(() => {
    setLibrary((lib) => ({ ...lib, [budget.id]: { ...budget, updatedAt: new Date().toISOString() } }));
  }, [budget]);

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary((lib) => {
      const n = { ...lib };
      delete n[id];
      return n;
    });
  }, []);

  const startNew = useCallback(() => setBudgetState(newBudget()), []);

  const savedIds = useMemo(() => new Set(Object.keys(library)), [library]);

  return { budget, update, replace, library, saveToLibrary, removeFromLibrary, startNew, isSaved: savedIds.has(budget.id) };
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(s: string): string {
  return (s || 'budget').replace(/[^\w\-. ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'budget';
}
