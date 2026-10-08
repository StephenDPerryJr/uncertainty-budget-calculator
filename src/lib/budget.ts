import type { Budget, Component } from './types';

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function newComponent(partial: Partial<Component> = {}): Component {
  return {
    id: uid('c'),
    name: 'New component',
    symbol: '',
    variable: '',
    source: 'other',
    sourceNote: '',
    distribution: 'rectangular',
    value: 0,
    valueIsFullWidth: false,
    scale: 'absolute',
    scaleReference: null,
    unit: '',
    k: 2,
    confidencePercent: 95,
    certDof: null,
    readings: '',
    nAveraged: null,
    pooledSd: 0,
    pooledDof: 0,
    sensitivityMode: 'manual',
    sensitivity: 1,
    dofMode: 'infinite',
    dof: null,
    reliabilityPercent: 0,
    notes: '',
    ...partial,
  };
}

export function newBudget(partial: Partial<Budget> = {}): Budget {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: uid('b'),
    title: 'Untitled uncertainty budget',
    measurand: { name: '', symbol: 'Y', unit: '', value: 0, description: '' },
    model: { enabled: false, expression: '', variables: [] },
    components: [],
    correlations: [],
    coverage: { mode: 'confidence', confidencePercent: 95.45, k: 2, dofHandling: 'truncate' },
    rounding: 'nearest',
    metadata: { laboratory: '', preparedBy: '', date: now.slice(0, 10), procedure: '', equipment: '', conditions: '', notes: '' },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Fill any missing fields (older / hand-edited / imported JSON) with defaults. */
export function normalizeBudget(raw: unknown): Budget {
  if (!raw || typeof raw !== 'object') throw new Error('Not a budget object');
  const r = raw as Partial<Budget>;
  if (!Array.isArray(r.components)) throw new Error('Budget JSON has no "components" array');
  const base = newBudget();
  return {
    ...base,
    ...r,
    schemaVersion: 1,
    id: typeof r.id === 'string' ? r.id : base.id,
    measurand: { ...base.measurand, ...(r.measurand ?? {}) },
    model: { ...base.model, ...(r.model ?? {}), variables: (r.model?.variables ?? []).map((v) => ({ ...{ name: '', value: 0, unit: '', description: '' }, ...v })) },
    components: r.components.map((c) => newComponent(c as Partial<Component>)),
    correlations: Array.isArray(r.correlations) ? r.correlations : [],
    coverage: { ...base.coverage, ...(r.coverage ?? {}) },
    metadata: { ...base.metadata, ...(r.metadata ?? {}) },
  };
}
