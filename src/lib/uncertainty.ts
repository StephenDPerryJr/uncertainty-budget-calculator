/**
 * Uncertainty engine: GUM (JCGM 100:2008) / NIST TN 1297 law of propagation of
 * uncertainty, Welch-Satterthwaite effective degrees of freedom, Student-t coverage
 * factors and GUM 7.2.6 rounding.  Pure functions, no DOM, fully unit-tested.
 */
import { compileModel, partialDerivative } from './expr';
import { confidencePercentToFraction, tFactor } from './stats';
import type {
  Budget,
  BudgetResult,
  Component,
  ComponentResult,
  DistributionKind,
  RoundedResult,
  TypeAStats,
} from './types';

export const SQRT2 = Math.SQRT2;
export const SQRT3 = Math.sqrt(3);
export const SQRT6 = Math.sqrt(6);
export const SQRT12 = Math.sqrt(12);

// ---------------------------------------------------------------- Type A

/** Parse pasted readings: separated by whitespace, newlines, ';' or ','. */
export function parseReadings(text: string): number[] {
  return text
    .split(/[\s;,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((v) => Number.isFinite(v));
}

/** Arithmetic mean, experimental standard deviation s (n-1, GUM 4.2.2) and s/sqrt(n) (GUM 4.2.3). */
export function typeAStats(values: number[]): TypeAStats {
  const n = values.length;
  if (n === 0) return { n: 0, mean: NaN, stdDev: NaN, stdDevOfMean: NaN, min: NaN, max: NaN };
  // two-pass algorithm for numerical stability
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let ss = 0;
  let comp = 0;
  for (const v of values) {
    ss += (v - mean) ** 2;
    comp += v - mean;
  }
  ss -= (comp * comp) / n;
  const stdDev = n > 1 ? Math.sqrt(Math.max(ss, 0) / (n - 1)) : NaN;
  return {
    n,
    mean,
    stdDev,
    stdDevOfMean: n > 1 ? stdDev / Math.sqrt(n) : NaN,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** Pooled standard deviation from several groups: sqrt(sum (n_i-1) s_i^2 / sum (n_i-1)), dof = sum(n_i - 1). */
export function pooledStdDev(groups: Array<{ n: number; s: number }>): { sp: number; dof: number } {
  let num = 0;
  let dof = 0;
  for (const g of groups) {
    if (g.n < 2) continue;
    num += (g.n - 1) * g.s * g.s;
    dof += g.n - 1;
  }
  return { sp: dof > 0 ? Math.sqrt(num / dof) : NaN, dof };
}

// ---------------------------------------------------------------- Type B helpers

/** GUM G.4.2 eq. (G.3): nu ~= 1/2 (delta u / u)^-2.  reliabilityPercent = 100 * delta u / u. */
export function dofFromReliability(reliabilityPercent: number): number {
  const r = reliabilityPercent / 100;
  if (!(r > 0)) return Infinity;
  return 0.5 / (r * r);
}

export function distributionDivisor(kind: 'rectangular' | 'triangular' | 'u-shaped' | 'resolution'): number {
  switch (kind) {
    case 'rectangular': return SQRT3;
    case 'triangular': return SQRT6;
    case 'u-shaped': return SQRT2;
    case 'resolution': return SQRT12; // r/2 half-interval, rectangular: (r/2)/sqrt3 = r/sqrt12
  }
}

/** Convert a value expressed as %, ppm or absolute into absolute units. */
export function toAbsolute(value: number, scale: 'absolute' | 'percent' | 'ppm', reference: number): number {
  switch (scale) {
    case 'absolute': return value;
    case 'percent': return (value / 100) * Math.abs(reference);
    case 'ppm': return value * 1e-6 * Math.abs(reference);
  }
}

/** Manufacturer accuracy spec  +/-(% of reading + % of range + n digits)  -> half-width a. */
export function specHalfWidth(opts: {
  reading: number;
  percentOfReading?: number;
  ppmOfReading?: number;
  range?: number;
  percentOfRange?: number;
  ppmOfRange?: number;
  digits?: number;
  resolution?: number;
  absolute?: number;
}): number {
  const r = Math.abs(opts.reading);
  const R = Math.abs(opts.range ?? 0);
  return (
    ((opts.percentOfReading ?? 0) / 100) * r +
    (opts.ppmOfReading ?? 0) * 1e-6 * r +
    ((opts.percentOfRange ?? 0) / 100) * R +
    (opts.ppmOfRange ?? 0) * 1e-6 * R +
    (opts.digits ?? 0) * (opts.resolution ?? 0) +
    (opts.absolute ?? 0)
  );
}

export function isTypeA(kind: DistributionKind): boolean {
  return kind === 'typeA-readings' || kind === 'typeA-pooled';
}

// ---------------------------------------------------------------- per component

export interface ComponentContext {
  /** value that % / ppm refers to when component.scaleReference is null */
  defaultReference: number;
  /** sensitivity computed from the model (when sensitivityMode === 'model') */
  modelSensitivity?: number | null;
}

/** Standard uncertainty, divisor and degrees of freedom of one component (before c_i). */
export function evaluateComponent(c: Component, ctx: ComponentContext): Omit<ComponentResult, 'percent' | 'variance' | 'ciui' | 'ci'> & { ci: number } {
  const errors: string[] = [];
  const ref = c.scaleReference ?? ctx.defaultReference;
  let abs = toAbsolute(c.value, c.scale, ref);
  if (c.scale !== 'absolute' && !(Math.abs(ref) > 0)) errors.push('A % or ppm value needs a non-zero reference value.');
  let divisor = 1;
  let divisorLabel = '1';
  let dof = Infinity;
  let typeA: TypeAStats | undefined;
  const type: 'A' | 'B' = isTypeA(c.distribution) ? 'A' : 'B';

  switch (c.distribution) {
    case 'normal-k':
      if (!(c.k > 0)) errors.push('Coverage factor k must be > 0.');
      divisor = c.k;
      divisorLabel = `k = ${fmtNum(c.k, 4)}`;
      break;
    case 'normal-conf': {
      const p = confidencePercentToFraction(c.confidencePercent);
      if (!(p > 0 && p < 1)) {
        errors.push('Confidence level must be between 0 and 100 %.');
        divisor = NaN;
      } else {
        const nu = c.certDof && c.certDof > 0 ? c.certDof : Infinity;
        divisor = tFactor(p, nu);
        divisorLabel = isFinite(nu)
          ? `t(${fmtNum(c.confidencePercent, 4)} %, ν=${fmtNum(nu, 4)}) = ${divisor.toFixed(3)}`
          : `k(${fmtNum(c.confidencePercent, 4)} %) = ${divisor.toFixed(3)}`;
      }
      break;
    }
    case 'normal-std':
      divisor = 1;
      divisorLabel = '1';
      break;
    case 'rectangular':
    case 'triangular':
    case 'u-shaped':
      if (c.valueIsFullWidth) abs = abs / 2;
      divisor = distributionDivisor(c.distribution);
      divisorLabel = c.distribution === 'rectangular' ? '√3' : c.distribution === 'triangular' ? '√6' : '√2';
      break;
    case 'resolution':
      divisor = SQRT12;
      divisorLabel = '√12 (=2√3)';
      break;
    case 'typeA-readings': {
      const vals = parseReadings(c.readings);
      typeA = typeAStats(vals);
      if (typeA.n < 2) {
        errors.push('Enter at least 2 readings for a Type A evaluation.');
        abs = NaN;
        divisor = 1;
      } else {
        const m = c.nAveraged && c.nAveraged > 0 ? c.nAveraged : typeA.n;
        abs = typeA.stdDev;
        divisor = Math.sqrt(m);
        divisorLabel = `√${m}`;
        dof = typeA.n - 1;
      }
      break;
    }
    case 'typeA-pooled': {
      const m = c.nAveraged && c.nAveraged > 0 ? c.nAveraged : 1;
      abs = c.pooledSd;
      divisor = Math.sqrt(m);
      divisorLabel = `√${m}`;
      dof = c.pooledDof > 0 ? c.pooledDof : Infinity;
      if (!(c.pooledDof > 0)) errors.push('Pooled degrees of freedom should be > 0.');
      break;
    }
  }

  // Type B degrees of freedom
  if (type === 'B') {
    if (c.dofMode === 'explicit') dof = c.dof && c.dof > 0 ? c.dof : Infinity;
    else if (c.dofMode === 'reliability') dof = dofFromReliability(c.reliabilityPercent);
    else if (c.distribution === 'normal-conf' || c.distribution === 'normal-k') dof = c.certDof && c.certDof > 0 ? c.certDof : Infinity;
    else dof = Infinity;
  }

  const ui = Math.abs(abs) / divisor;
  let ci = c.sensitivity;
  if (c.sensitivityMode === 'model') {
    if (ctx.modelSensitivity == null || !Number.isFinite(ctx.modelSensitivity)) {
      errors.push('Sensitivity from the model is unavailable (check the model and the linked variable).');
      ci = NaN;
    } else ci = ctx.modelSensitivity;
  }
  if (!Number.isFinite(ui)) errors.push('Standard uncertainty could not be computed; check the inputs.');
  return { id: c.id, type, absoluteValue: abs, divisor, divisorLabel, ui, ci, dof, typeA, errors };
}

// ---------------------------------------------------------------- combination

/**
 * Welch-Satterthwaite (GUM G.4.1 eq. G.2b, TN 1297 B.3):
 *   nu_eff = uc^4 / sum( u_i(y)^4 / nu_i ),  u_i(y) = |c_i| u(x_i)
 * Terms with nu_i = Infinity or u_i(y) = 0 contribute nothing.
 * Returns Infinity when every term has infinite dof.
 */
export function welchSatterthwaite(contribs: Array<{ ui: number; dof: number }>, uc?: number): number {
  const ucv = uc ?? Math.sqrt(contribs.reduce((s, c) => s + c.ui * c.ui, 0));
  let denom = 0;
  for (const c of contribs) {
    if (!isFinite(c.dof) || c.ui === 0) continue;
    denom += c.ui ** 4 / c.dof;
  }
  if (denom === 0) return Infinity;
  return ucv ** 4 / denom;
}

/** Combined variance with correlation: sum (c_i u_i)^2 + 2 sum_{i<j} c_i c_j u_i u_j r_ij (GUM 5.2.2 eq. 16). */
export function combinedVariance(ciui: number[], corr: Array<{ i: number; j: number; r: number }> = []): { total: number; correlationTerm: number } {
  const base = ciui.reduce((s, v) => s + v * v, 0);
  let cross = 0;
  for (const { i, j, r } of corr) {
    if (i === j) continue;
    cross += 2 * ciui[i] * ciui[j] * r;
  }
  return { total: base + cross, correlationTerm: cross };
}

/** Coverage factor for confidence p (percent) and effective dof (GUM G.6.4). */
export function coverageFactor(confidencePercent: number, veff: number, handling: 'truncate' | 'interpolate' = 'truncate'): { k: number; dofUsed: number; p: number } {
  const p = confidencePercentToFraction(confidencePercent);
  let nu = veff;
  if (isFinite(nu) && handling === 'truncate') nu = Math.floor(nu);
  if (nu < 1) nu = 1;
  return { k: tFactor(p, nu), dofUsed: nu, p };
}

// ---------------------------------------------------------------- rounding (GUM 7.2.6)

/** Round to `sig` significant figures. mode 'up' always rounds away from zero (conservative). */
export function roundSig(x: number, sig = 2, mode: 'nearest' | 'up' = 'nearest'): { value: number; exponent: number } {
  if (!Number.isFinite(x) || x === 0) return { value: x, exponent: 0 };
  const exponent = Math.floor(Math.log10(Math.abs(x))) - (sig - 1);
  // work in scaled integers; nudge by a few ulps so 58.5 (stored as 58.4999..) still rounds as written
  const scaled = Math.abs(x) / Math.pow(10, exponent);
  let n: number;
  if (mode === 'up') n = Math.ceil(scaled - 1e-9);
  else n = Math.round(scaled + 1e-9);
  // carrying (e.g. 9.96 -> 10) adds a digit; keep exponent consistent
  let exp = exponent;
  if (n >= Math.pow(10, sig)) {
    n = n / 10;
    exp += 1;
  }
  const value = Math.sign(x) * (exp >= 0 ? n * Math.pow(10, exp) : n / Math.pow(10, -exp));
  return { value, exponent: exp };
}

/** Round a value to a given decimal exponent (10^exponent place). */
export function roundToExponent(x: number, exponent: number): number {
  if (!Number.isFinite(x)) return x;
  if (exponent >= 0) return Math.round(x / Math.pow(10, exponent)) * Math.pow(10, exponent);
  const f = Math.pow(10, -exponent);
  return Math.round(x * f) / f;
}

export function formatAtExponent(x: number, exponent: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (exponent < 0) return roundToExponent(x, exponent).toFixed(-exponent);
  return roundToExponent(x, exponent).toFixed(0);
}

/**
 * GUM 7.2.6 reporting: U to (at most) two significant digits; the estimate y
 * rounded to the same decimal position.  'up' implements the conservative option
 * mentioned in 7.2.6 (e.g. 10.47 -> 11).
 */
export function roundForReport(y: number, uc: number, U: number, mode: 'nearest' | 'up' = 'nearest'): RoundedResult {
  const r = roundSig(U, 2, mode);
  const ucr = roundSig(uc, 2, mode);
  const decimals = Math.max(0, -r.exponent);
  return {
    U: r.value,
    Utext: formatAtExponent(r.value, r.exponent),
    y: roundToExponent(y, r.exponent),
    ytext: Number.isFinite(y) ? formatAtExponent(y, r.exponent) : '—',
    uc: ucr.value,
    uctext: formatAtExponent(ucr.value, ucr.exponent),
    decimals,
  };
}

// ---------------------------------------------------------------- whole budget

export function modelValues(b: Budget): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const v of b.model.variables) vars[v.name] = v.value;
  return vars;
}

export function computeBudget(b: Budget): BudgetResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let y = b.measurand.value;
  let yError: string | null = null;
  let f: ((v: Record<string, number>) => number) | null = null;
  const vars = modelValues(b);

  if (b.model.enabled) {
    try {
      const m = compileModel(b.model.expression);
      const missing = m.variables.filter((v) => !(v in vars));
      if (missing.length) throw new ReferenceError(`Model variables without a value: ${missing.join(', ')}`);
      f = m.evaluate;
      y = f(vars);
      if (!Number.isFinite(y)) throw new RangeError('Model evaluates to a non-finite value.');
    } catch (e) {
      yError = (e as Error).message;
      errors.push(`Measurement model: ${yError}`);
      f = null;
    }
  }

  // first pass: standard uncertainties (needed as step hints for derivatives)
  const pre = b.components.map((c) => {
    const ref = c.variable && c.variable in vars ? vars[c.variable] : y;
    return { c, ref };
  });

  const results: ComponentResult[] = pre.map(({ c, ref }) => {
    let modelSensitivity: number | null = null;
    if (c.sensitivityMode === 'model') {
      if (f && c.variable && c.variable in vars) {
        const first = evaluateComponent(c, { defaultReference: ref, modelSensitivity: 1 });
        try {
          modelSensitivity = partialDerivative(f, vars, c.variable, first.ui);
        } catch {
          modelSensitivity = null;
        }
      }
    }
    const r = evaluateComponent(c, { defaultReference: ref, modelSensitivity });
    if (c.sensitivityMode === 'model' && !c.variable) r.errors.push('Link this component to a model variable to compute its sensitivity coefficient.');
    const ciui = r.ci * r.ui;
    return { ...r, ciui, variance: ciui * ciui, percent: 0 };
  });

  const valid = results.filter((r) => r.errors.length === 0 && Number.isFinite(r.ciui));
  results.forEach((r) => {
    if (r.errors.length) errors.push(`${nameOf(b, r.id)}: ${r.errors.join(' ')}`);
  });

  // correlations
  const idx = new Map(results.map((r, i) => [r.id, i]));
  const corr: Array<{ i: number; j: number; r: number }> = [];
  for (const cc of b.correlations) {
    const i = idx.get(cc.a);
    const j = idx.get(cc.b);
    if (i === undefined || j === undefined || i === j || cc.r === 0) continue;
    if (Math.abs(cc.r) > 1) {
      errors.push(`Correlation coefficient ${cc.r} is outside [-1, 1].`);
      continue;
    }
    corr.push({ i, j, r: cc.r });
  }
  const ciuiAll = results.map((r) => (r.errors.length === 0 && Number.isFinite(r.ciui) ? r.ciui : 0));
  const { total, correlationTerm } = combinedVariance(ciuiAll, corr);
  if (total < 0) errors.push('Combined variance is negative: check the correlation coefficients.');
  const uc = Math.sqrt(Math.max(total, 0));
  results.forEach((r) => {
    r.percent = total > 0 && Number.isFinite(r.variance) && r.errors.length === 0 ? (r.variance / total) * 100 : 0;
  });
  if (corr.length) warnings.push('Correlations present: % contributions are shares of the uncorrelated variance sum and the Welch-Satterthwaite formula is only an approximation (GUM G.4.1 assumes independent inputs).');

  const veff = welchSatterthwaite(valid.map((r) => ({ ui: Math.abs(r.ciui), dof: r.dof })), uc);

  let k: number;
  let dofUsed = veff;
  let p: number | null = null;
  if (b.coverage.mode === 'fixed-k') {
    k = b.coverage.k;
    if (isFinite(veff) && veff < 30) warnings.push(`ν_eff = ${veff.toFixed(1)} is small; a fixed k = ${k} may give a coverage probability lower than intended. Consider the Student-t coverage factor.`);
  } else {
    const cf = coverageFactor(b.coverage.confidencePercent, veff, b.coverage.dofHandling);
    k = cf.k;
    dofUsed = cf.dofUsed;
    p = cf.p;
    if (veff < 1) warnings.push('ν_eff < 1: coverage factor computed at ν = 1.');
  }
  const U = k * uc;

  // dominance check (GUM G.6.5 / EA-4/02: one dominant non-normal term)
  const dominant = results.find((r) => r.percent > 80);
  if (dominant) {
    const comp = b.components.find((c) => c.id === dominant.id)!;
    if (comp.distribution === 'rectangular' || comp.distribution === 'resolution' || comp.distribution === 'u-shaped')
      warnings.push(`"${comp.name}" contributes ${dominant.percent.toFixed(0)} % of the variance and is not normally distributed; the output is then not approximately normal and k from the t-distribution may be inappropriate (see EA-4/02 Annex E / GUM G.6.5). For a dominant rectangular term, U ≈ 1.65·u is the 95 % half-width.`);
  }
  results.forEach((r) => {
    if (r.ci === 0 && r.errors.length === 0) warnings.push(`${nameOf(b, r.id)} has sensitivity c = 0 and contributes nothing to first order (consider second-order terms, GUM 5.1.2 note, H.1.7).`);
  });

  return {
    components: results,
    y,
    yError,
    ucSquared: total,
    uc,
    correlationTerm,
    veff,
    dofUsed,
    p,
    k,
    U,
    reported: Number.isFinite(U) && U > 0 ? roundForReport(y, uc, U, b.rounding) : null,
    relativeUc: Number.isFinite(y) && y !== 0 ? uc / Math.abs(y) : null,
    warnings,
    errors,
  };
}

function nameOf(b: Budget, id: string): string {
  return b.components.find((c) => c.id === id)?.name || 'Component';
}

export function fmtNum(x: number | null | undefined, sig = 4): string {
  if (x === null || x === undefined) return '—';
  if (x === Infinity) return '∞';
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e6) return String(Number(x.toPrecision(sig)));
  return x.toExponential(sig - 1).replace(/\.?0+e/, 'e');
}

export function fmtDof(nu: number): string {
  if (!isFinite(nu)) return '∞';
  if (Number.isInteger(nu) || nu >= 100) return nu.toFixed(0);
  return nu.toFixed(1);
}
