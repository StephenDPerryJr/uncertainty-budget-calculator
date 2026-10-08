export type DistributionKind =
  | 'normal-k' // expanded uncertainty U with stated coverage factor k (certificates)
  | 'normal-conf' // expanded uncertainty at a stated confidence level (e.g. 95 %), optional nu
  | 'normal-std' // a standard uncertainty (1 sigma) given directly
  | 'rectangular' // limits +/- a, equal probability (specs, tolerances)
  | 'triangular' // limits +/- a, values near centre more likely
  | 'u-shaped' // arcsine: sinusoidal / cycling quantities (e.g. temperature cycling, RF mismatch)
  | 'resolution' // digital resolution r -> half-interval r/2, rectangular
  | 'typeA-readings' // Type A from pasted repeated readings
  | 'typeA-pooled'; // Type A from a pooled / historical standard deviation

export type InputScale = 'absolute' | 'percent' | 'ppm';
export type SensitivityMode = 'manual' | 'model';
export type DofMode = 'infinite' | 'reliability' | 'explicit';

export type SourceType =
  | 'calibration-certificate'
  | 'manufacturer-spec'
  | 'repeatability'
  | 'reproducibility'
  | 'historical'
  | 'environmental'
  | 'resolution'
  | 'drift'
  | 'reference-data'
  | 'method'
  | 'other';

export interface Component {
  id: string;
  name: string;
  symbol: string;
  variable: string; // model variable this component is an uncertainty of ('' = none)
  source: SourceType;
  sourceNote: string;
  distribution: DistributionKind;
  value: number; // U, half-width a, std dev, resolution r, ... (meaning depends on distribution)
  valueIsFullWidth: boolean; // rectangular/triangular/u-shaped: value is full width (2a)
  scale: InputScale;
  scaleReference: number | null; // value that % / ppm refers to (null = linked variable / measurand value)
  unit: string;
  k: number; // normal-k
  confidencePercent: number; // normal-conf
  certDof: number | null; // normal-conf / normal-k: stated effective dof (null = infinite)
  readings: string; // typeA-readings
  nAveraged: number | null; // number of readings averaged in the reported result (null = n)
  pooledSd: number; // typeA-pooled
  pooledDof: number;
  sensitivityMode: SensitivityMode;
  sensitivity: number;
  dofMode: DofMode;
  dof: number | null; // explicit
  reliabilityPercent: number; // GUM G.4.2 relative uncertainty of u, in %
  notes: string;
}

export interface ModelVariable {
  name: string;
  value: number;
  unit: string;
  description: string;
}

export interface Correlation {
  a: string; // component id
  b: string;
  r: number;
}

export interface Budget {
  schemaVersion: 1;
  id: string;
  title: string;
  measurand: {
    name: string;
    symbol: string;
    unit: string;
    value: number; // used when no model
    description: string;
  };
  model: {
    enabled: boolean;
    expression: string;
    variables: ModelVariable[];
  };
  components: Component[];
  correlations: Correlation[];
  coverage: {
    mode: 'confidence' | 'fixed-k';
    confidencePercent: number;
    k: number;
    dofHandling: 'truncate' | 'interpolate';
  };
  rounding: 'nearest' | 'up';
  metadata: {
    laboratory: string;
    preparedBy: string;
    date: string;
    procedure: string;
    equipment: string;
    conditions: string;
    notes: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TypeAStats {
  n: number;
  mean: number;
  stdDev: number;
  stdDevOfMean: number;
  min: number;
  max: number;
}

export interface ComponentResult {
  id: string;
  type: 'A' | 'B';
  absoluteValue: number; // input value after %/ppm conversion (and full-width halving)
  divisor: number;
  divisorLabel: string;
  ui: number; // standard uncertainty of the input quantity
  ci: number;
  ciui: number; // signed c_i * u_i
  dof: number; // Infinity allowed
  variance: number; // (c_i u_i)^2
  percent: number; // variance / uc^2 * 100
  typeA?: TypeAStats;
  errors: string[];
}

export interface BudgetResult {
  components: ComponentResult[];
  y: number; // estimate of the measurand
  yError: string | null;
  ucSquared: number;
  uc: number;
  correlationTerm: number;
  veff: number;
  dofUsed: number;
  p: number | null; // coverage probability fraction (null in fixed-k mode)
  k: number;
  U: number;
  reported: RoundedResult | null;
  relativeUc: number | null;
  warnings: string[];
  errors: string[];
}

export interface RoundedResult {
  U: number;
  Utext: string;
  y: number;
  ytext: string;
  uc: number;
  uctext: string;
  decimals: number;
}
