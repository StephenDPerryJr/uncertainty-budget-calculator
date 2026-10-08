import { describe, expect, it } from 'vitest';
import { newBudget, newComponent, normalizeBudget } from '../budget';
import { caliperExample, eaS2, gumH1 } from '../examples';
import { compileModel, partialDerivative } from '../expr';
import { tFactor } from '../stats';
import {
  combinedVariance,
  computeBudget,
  coverageFactor,
  dofFromReliability,
  evaluateComponent,
  parseReadings,
  pooledStdDev,
  roundForReport,
  roundSig,
  specHalfWidth,
  toAbsolute,
  typeAStats,
  welchSatterthwaite,
} from '../uncertainty';

const ctx = { defaultReference: 0 };

describe('Type A evaluation (GUM 4.2)', () => {
  // GUM 4.4.3 Table 1: twenty temperature observations
  const gum443 = '96.90 98.18 98.25 98.61 99.03 99.49 99.56 99.74 99.89 100.07 100.33 100.42 100.68 100.95 101.11 101.20 101.57 101.84 102.36 102.72';
  it('GUM 4.4.3: mean 100.145 °C, s = 1.489 °C, s(mean) = 0.333 °C, nu = 19', () => {
    const s = typeAStats(parseReadings(gum443));
    expect(s.n).toBe(20);
    expect(s.mean).toBeCloseTo(100.145, 3);
    expect(s.stdDev).toBeCloseTo(1.489, 3);
    expect(s.stdDevOfMean).toBeCloseTo(0.333, 3);
    const r = evaluateComponent(newComponent({ distribution: 'typeA-readings', readings: gum443 }), ctx);
    expect(r.ui).toBeCloseTo(0.333, 3);
    expect(r.dof).toBe(19);
    expect(r.type).toBe('A');
  });
  it('accepts comma / semicolon / newline separated readings and a different number averaged', () => {
    expect(parseReadings('1,2;3\n4\t5')).toEqual([1, 2, 3, 4, 5]);
    const r = evaluateComponent(newComponent({ distribution: 'typeA-readings', readings: '1 2 3 4 5 6 7 8 9 10', nAveraged: 1 }), ctx);
    expect(r.ui).toBeCloseTo(3.0276503540974917, 12); // single-reading s
  });
  it('pooled standard deviation and GUM H.1.3.2 u(d) = 13 nm / sqrt(5) = 5.8 nm, nu = 24', () => {
    expect(pooledStdDev([{ n: 5, s: 2 }, { n: 5, s: 4 }]).sp).toBeCloseTo(Math.sqrt(10), 12);
    const r = evaluateComponent(newComponent({ distribution: 'typeA-pooled', pooledSd: 13, pooledDof: 24, nAveraged: 5 }), ctx);
    expect(r.ui).toBeCloseTo(5.81, 2);
    expect(r.dof).toBe(24);
  });
});

describe('Type B evaluation and divisors (GUM 4.3)', () => {
  it('rectangular a/sqrt3, triangular a/sqrt6, U-shaped a/sqrt2, resolution r/sqrt12', () => {
    expect(evaluateComponent(newComponent({ distribution: 'rectangular', value: 2e-6 }), ctx).ui).toBeCloseTo(1.1547e-6, 10); // GUM H.1.3.3: 1.2e-6
    expect(evaluateComponent(newComponent({ distribution: 'triangular', value: 6 }), ctx).ui).toBeCloseTo(6 / Math.sqrt(6), 12);
    expect(evaluateComponent(newComponent({ distribution: 'u-shaped', value: 0.5 }), ctx).ui).toBeCloseTo(0.35355, 5); // GUM H.1.3.4: 0.35 °C
    expect(evaluateComponent(newComponent({ distribution: 'resolution', value: 0.01 }), ctx).ui).toBeCloseTo(0.0028868, 7);
    expect(evaluateComponent(newComponent({ distribution: 'rectangular', value: 0.1, valueIsFullWidth: true }), ctx).ui).toBeCloseTo(0.05 / Math.sqrt(3), 12);
  });
  it('certificate U with k, and U at a confidence level with stated nu (GUM H.1.3.2: 0.01 µm / t95(5) = 3.9 nm)', () => {
    expect(evaluateComponent(newComponent({ distribution: 'normal-k', value: 75, k: 3 }), ctx).ui).toBeCloseTo(25, 12);
    const d1 = evaluateComponent(newComponent({ distribution: 'normal-conf', value: 10, confidencePercent: 95, certDof: 5 }), ctx);
    expect(d1.divisor).toBeCloseTo(2.5706, 4);
    expect(d1.ui).toBeCloseTo(3.89, 2);
    expect(d1.dof).toBe(5);
    expect(evaluateComponent(newComponent({ distribution: 'normal-conf', value: 1.96, confidencePercent: 95 }), ctx).ui).toBeCloseTo(1.96 / 1.959964, 5);
  });
  it('GUM G.4.2 relative reliability: 25 % -> nu = 8, 10 % -> 50, 50 % -> 2', () => {
    expect(dofFromReliability(25)).toBe(8);
    expect(dofFromReliability(10)).toBeCloseTo(50, 10);
    expect(dofFromReliability(50)).toBe(2);
    expect(dofFromReliability(0)).toBe(Infinity);
  });
  it('% and ppm conversions and manufacturer spec half-width', () => {
    expect(toAbsolute(0.05, 'percent', 100)).toBeCloseTo(0.05, 15);
    expect(toAbsolute(10, 'ppm', 10)).toBeCloseTo(1e-4, 15);
    expect(evaluateComponent(newComponent({ distribution: 'rectangular', value: 1, scale: 'ppm', scaleReference: 10000 }), ctx).ui).toBeCloseTo(0.01 / Math.sqrt(3), 12);
    expect(specHalfWidth({ reading: 10, percentOfReading: 0.02, range: 20, percentOfRange: 0.005, digits: 2, resolution: 0.001 })).toBeCloseTo(0.005, 12);
  });
});

describe('Welch-Satterthwaite (GUM G.4.1, TN 1297 B.3)', () => {
  it('GUM G.4.1 example: relative u 0.25 %, 0.57 %, 0.82 % with n = 10, 5, 15 -> nu_eff = 19.0, t95(19) = 2.09, U95 = 2.2 %', () => {
    const c = [{ ui: 0.25, dof: 9 }, { ui: 0.57, dof: 4 }, { ui: 0.82, dof: 14 }];
    const uc = Math.sqrt(c.reduce((s, x) => s + x.ui ** 2, 0));
    expect(uc).toBeCloseTo(1.03, 2);
    // GUM evaluates G.2b with the rounded uc/y = 1.03 % -> 19.04 -> "19.0"
    const veff = welchSatterthwaite(c, 1.03);
    expect(veff).toBeCloseTo(19.0, 1);
    const cf = coverageFactor(95, veff);
    expect(cf.dofUsed).toBe(19);
    expect(cf.k).toBeCloseTo(2.09, 2);
    expect(Number((cf.k * 1.03).toFixed(1))).toBe(2.2);
    // unrounded: 18.9987 (truncates to 18, t95 = 2.10) - U95 is still 2.2 %
    const veffRaw = welchSatterthwaite(c);
    expect(veffRaw).toBeCloseTo(18.9987, 4);
    const cfRaw = coverageFactor(95, veffRaw);
    expect(cfRaw.k).toBeCloseTo(2.10, 2);
    expect(Number((cfRaw.k * uc).toFixed(1))).toBe(2.2);
  });
  it('GUM H.1.6 sub-budget: u(d) from 5.8, 3.9, 6.7 nm with nu 24, 5, 8 -> u(d) = 9.7 nm, nu_eff(d) = 25.6', () => {
    const c = [{ ui: 5.8, dof: 24 }, { ui: 3.9, dof: 5 }, { ui: 6.7, dof: 8 }];
    const ud = Math.sqrt(c.reduce((s, x) => s + x.ui ** 2, 0));
    expect(ud).toBeCloseTo(9.7, 1);
    // GUM evaluates with the rounded u(d) = 9.7 nm
    expect(welchSatterthwaite(c, 9.7)).toBeCloseTo(25.6, 1);
  });
  it('all-infinite dof -> infinity; zero contributions ignored', () => {
    expect(welchSatterthwaite([{ ui: 1, dof: Infinity }, { ui: 2, dof: Infinity }])).toBe(Infinity);
    expect(welchSatterthwaite([{ ui: 1, dof: 4 }, { ui: 0, dof: 1 }])).toBeCloseTo(4, 12);
  });
});

describe('correlation (GUM 5.2.2)', () => {
  it('r = +1 adds linearly, r = -1 cancels, r = 0 adds in quadrature', () => {
    expect(Math.sqrt(combinedVariance([1, 1], [{ i: 0, j: 1, r: 1 }]).total)).toBeCloseTo(2, 12);
    expect(Math.sqrt(combinedVariance([1, 1], [{ i: 0, j: 1, r: -1 }]).total)).toBeCloseTo(0, 12);
    expect(Math.sqrt(combinedVariance([1, 1]).total)).toBeCloseTo(Math.SQRT2, 12);
  });
  it('is applied in computeBudget', () => {
    const a = newComponent({ distribution: 'normal-std', value: 3 });
    const b = newComponent({ distribution: 'normal-std', value: 4 });
    const base = newBudget({ components: [a, b], coverage: { mode: 'fixed-k', k: 2, confidencePercent: 95.45, dofHandling: 'truncate' } });
    expect(computeBudget(base).uc).toBeCloseTo(5, 12);
    expect(computeBudget({ ...base, correlations: [{ a: a.id, b: b.id, r: 1 }] }).uc).toBeCloseTo(7, 12);
  });
});

describe('GUM 7.2.6 rounding', () => {
  it('two significant digits; "up" mode reproduces 10.47 -> 11; nearest gives 28.05 -> 28', () => {
    expect(roundSig(10.47, 2, 'up').value).toBe(11);
    expect(roundSig(28.05, 2, 'nearest').value).toBe(28);
    expect(roundSig(0.0123456, 2).value).toBeCloseTo(0.012, 15);
    expect(roundSig(9.96, 2).value).toBe(10);
    expect(roundSig(58.5, 2).value).toBe(59);
  });
  it('estimate is rounded to the same decimal place: y = 10.05762 Ω with uc = 27 mΩ -> 10.058 Ω', () => {
    const r = roundForReport(10.05762, 0.027, 0.027, 'nearest');
    expect(r.ytext).toBe('10.058');
    expect(r.Utext).toBe('0.027');
  });
});

describe('measurement model and numerical sensitivity coefficients', () => {
  it('parses precedence, powers and functions', () => {
    expect(compileModel('2 + 3*4^2/8 - -1').evaluate({})).toBe(9);
    expect(compileModel('-x^2').evaluate({ x: 3 })).toBe(-9);
    expect(compileModel('sqrt(a^2 + b^2)').evaluate({ a: 3, b: 4 })).toBe(5);
    expect(compileModel('V^2/R * (1 + alpha*(t - 20))').variables.sort()).toEqual(['R', 'V', 'alpha', 't']);
    expect(() => compileModel('2 +')).toThrow();
    expect(() => compileModel('foo(1)')).toThrow();
  });
  it('partial derivatives match analytic values', () => {
    const f = compileModel('V^2/R').evaluate;
    expect(partialDerivative(f, { V: 10, R: 50 }, 'V')).toBeCloseTo(2 * 10 / 50, 9);
    expect(partialDerivative(f, { V: 10, R: 50 }, 'R')).toBeCloseTo(-100 / 2500, 9);
    expect(partialDerivative(compileModel('sin(x)').evaluate, { x: 0.3 }, 'x')).toBeCloseTo(Math.cos(0.3), 9);
    expect(partialDerivative(compileModel('a*b').evaluate, { a: 0, b: 7 }, 'a')).toBeCloseTo(7, 9);
  });
});

describe('GUM H.1 end-gauge calibration (full budget from raw inputs, model-derived c_i)', () => {
  const b = gumH1();
  const r = computeBudget(b);
  const nm = (mm: number) => mm * 1e6;
  const byName = (s: string) => r.components[b.components.findIndex((c) => c.symbol === s)];

  it('estimate l = 50.000 838 mm', () => {
    expect(r.errors).toEqual([]);
    expect(r.y).toBeCloseTo(50.000838, 9);
  });
  it('sensitivity coefficients: c(lS) = 1, c(αS) = 0, c(θ) = 0, c(δα) = −lS·θ, c(δθ) = −lS·αS', () => {
    expect(byName('u(lS)').ci).toBeCloseTo(1, 9);
    expect(byName('u(αS)').ci).toBe(0);
    expect(byName('u(θ̄)').ci).toBe(0);
    expect(byName('u(δα)').ci).toBeCloseTo(50.000623 * 0.1, 6);
    expect(byName('u(δθ)').ci).toBeCloseTo(-50.000623 * 11.5e-6, 10);
  });
  it('Table H.1 contributions: 25, (5.8, 3.9, 6.7 -> 9.7), 2.9, 16.6 nm', () => {
    expect(nm(Math.abs(byName('u(lS)').ciui))).toBeCloseTo(25, 6);
    expect(nm(byName('u(d̄)').ui)).toBeCloseTo(5.8, 1);
    expect(nm(byName('u(d1)').ui)).toBeCloseTo(3.9, 1);
    expect(nm(byName('u(d2)').ui)).toBeCloseTo(6.7, 1);
    expect(nm(Math.abs(byName('u(δα)').ciui))).toBeCloseTo(2.9, 1);
    expect(nm(Math.abs(byName('u(δθ)').ciui))).toBeCloseTo(16.6, 1);
    expect(byName('u(d2)').dof).toBe(8);
    expect(byName('u(δα)').dof).toBeCloseTo(50, 9);
    expect(byName('u(δθ)').dof).toBe(2);
  });
  it('uc^2 = 1002 nm^2, uc = 32 nm, nu_eff = 16.7 -> 16, k = t99(16) = 2.92', () => {
    expect(nm(nm(r.ucSquared))).toBeCloseTo(1002, 0);
    expect(nm(r.uc)).toBeCloseTo(31.66, 2);
    expect(r.reported!.uctext).toBe('0.000032');
    expect(r.veff).toBeCloseTo(16.7, 1);
    expect(r.dofUsed).toBe(16);
    expect(r.k).toBeCloseTo(2.92, 2);
    expect(r.k).toBeCloseTo(tFactor(0.99, 16), 12);
  });
  it('U99: GUM prints 93 nm = 2.92 x (rounded uc 32 nm); unrounded uc gives 92.5 nm -> 92 (nearest) / 93 (round-up mode)', () => {
    expect(Math.round(2.92 * 32)).toBe(93);
    expect(nm(r.U)).toBeCloseTo(92.47, 1);
    expect(r.reported!.Utext).toBe('0.000092');
    const up = computeBudget({ ...b, rounding: 'up' });
    expect(up.reported!.Utext).toBe('0.000093');
    expect(up.reported!.ytext).toBe('50.000838');
  });
});

describe('EA-4/02 M:2022 S2: calibration of a 10 kg weight', () => {
  it('raw inputs: u(mX) = 29.3 mg -> U = 2 x 29.3 = 58.5 mg; mX = 10 000.025 g', () => {
    const r = computeBudget(eaS2());
    expect(r.errors).toEqual([]);
    expect(r.y).toBeCloseTo(10000.025, 9);
    const mg = r.components.map((c) => c.ui * 1000);
    expect(mg[0]).toBeCloseTo(22.5, 6);
    expect(mg[1]).toBeCloseTo(8.66, 2);
    expect(mg[2]).toBeCloseTo(14.43, 2);
    expect(mg[3]).toBeCloseTo(5.77, 2);
    expect(mg[4]).toBeCloseTo(5.77, 2);
    expect(r.uc * 1000).toBeCloseTo(29.26, 2);
    expect(r.k).toBe(2);
    expect(r.U * 1000).toBeCloseTo(58.52, 2);
  });
  it('with the rounded table values printed in S2.9 (22.5, 8.66, 14.4, 5.77, 5.77 mg): u = 29.2 mg, U = 58 mg as published', () => {
    const comps = [22.5, 8.66, 14.4, 5.77, 5.77].map((u) => newComponent({ distribution: 'normal-std', value: u / 1000, unit: 'g' }));
    const r = computeBudget(newBudget({ measurand: { name: 'mX', symbol: 'mX', unit: 'g', value: 10000.025, description: '' }, components: comps, coverage: { mode: 'fixed-k', k: 2, confidencePercent: 95.45, dofHandling: 'truncate' } }));
    expect(Number((r.uc * 1000).toFixed(1))).toBe(29.2);
    expect(r.reported!.Utext).toBe('0.058');
    expect(r.reported!.ytext).toBe('10000.025');
  });
});

describe('budget plumbing', () => {
  it('% contributions sum to 100 without correlation and the caliper example computes', () => {
    const r = computeBudget(caliperExample());
    expect(r.errors).toEqual([]);
    expect(r.components.reduce((s, c) => s + c.percent, 0)).toBeCloseTo(100, 9);
    expect(r.veff).toBeGreaterThan(9);
  });
  it('JSON round-trip through normalizeBudget preserves the result', () => {
    const b = gumH1();
    const back = normalizeBudget(JSON.parse(JSON.stringify(b)));
    expect(computeBudget(back).U).toBeCloseTo(computeBudget(b).U, 15);
  });
  it('reports errors for incomplete components instead of producing silent numbers', () => {
    const r = computeBudget(newBudget({ components: [newComponent({ name: 'A', distribution: 'typeA-readings', readings: '1' })] }));
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

import { budgetToCSV, budgetToHTML, CSV_HEADER } from '../report';
describe('report export', () => {
  it('CSV contains every component row with all columns and the result block', () => {
    const b = gumH1();
    const r = computeBudget(b);
    const csv = budgetToCSV(b, r);
    expect(csv).toContain(CSV_HEADER.join(','));
    for (const c of b.components) expect(csv).toContain(c.name);
    expect(csv).toContain('Effective degrees of freedom veff');
    expect(csv).toContain('Coverage factor k');
    expect(csv).toContain('50.000838 ± 0.000092');
  });
  it('HTML report escapes user text and includes references', () => {
    const b = caliperExample();
    b.title = '<script>alert(1)</script>';
    const html = budgetToHTML(b, computeBudget(b));
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('JCGM 100:2008');
    expect(html).toContain('Welch');
  });
});
