import { describe, expect, it } from 'vitest';
import { confidencePercentToFraction, erf, incBeta, lnGamma, normCdf, normInv, studentTCdf, tFactor } from '../stats';

// JCGM 100:2008 (GUM) Table G.2 == NIST TN 1297 Table B.1 (identical values), transcribed verbatim.
const P = [68.27, 90, 95, 95.45, 99, 99.73];
const TABLE_G2: Array<[number, number[]]> = [
  [1, [1.84, 6.31, 12.71, 13.97, 63.66, 235.8]],
  [2, [1.32, 2.92, 4.3, 4.53, 9.92, 19.21]],
  [3, [1.2, 2.35, 3.18, 3.31, 5.84, 9.22]],
  [4, [1.14, 2.13, 2.78, 2.87, 4.6, 6.62]],
  [5, [1.11, 2.02, 2.57, 2.65, 4.03, 5.51]],
  [6, [1.09, 1.94, 2.45, 2.52, 3.71, 4.9]],
  [7, [1.08, 1.89, 2.36, 2.43, 3.5, 4.53]],
  [8, [1.07, 1.86, 2.31, 2.37, 3.36, 4.28]],
  [9, [1.06, 1.83, 2.26, 2.32, 3.25, 4.09]],
  [10, [1.05, 1.81, 2.23, 2.28, 3.17, 3.96]],
  [11, [1.05, 1.8, 2.2, 2.25, 3.11, 3.85]],
  [12, [1.04, 1.78, 2.18, 2.23, 3.05, 3.76]],
  [13, [1.04, 1.77, 2.16, 2.21, 3.01, 3.69]],
  [14, [1.04, 1.76, 2.14, 2.2, 2.98, 3.64]],
  [15, [1.03, 1.75, 2.13, 2.18, 2.95, 3.59]],
  [16, [1.03, 1.75, 2.12, 2.17, 2.92, 3.54]],
  [17, [1.03, 1.74, 2.11, 2.16, 2.9, 3.51]],
  [18, [1.03, 1.73, 2.1, 2.15, 2.88, 3.48]],
  [19, [1.03, 1.73, 2.09, 2.14, 2.86, 3.45]],
  [20, [1.03, 1.72, 2.09, 2.13, 2.85, 3.42]],
  [25, [1.02, 1.71, 2.06, 2.11, 2.79, 3.33]],
  [30, [1.02, 1.7, 2.04, 2.09, 2.75, 3.27]],
  [35, [1.01, 1.7, 2.03, 2.07, 2.72, 3.23]],
  [40, [1.01, 1.68, 2.02, 2.06, 2.7, 3.2]],
  [45, [1.01, 1.68, 2.01, 2.06, 2.69, 3.18]],
  [50, [1.01, 1.68, 2.01, 2.05, 2.68, 3.16]],
];
const ROW_100 = [1.005, 1.66, 1.984, 2.025, 2.626, 3.077];
const ROW_INF = [1.0, 1.645, 1.96, 2.0, 2.576, 3.0];

describe('special functions', () => {
  it('lnGamma matches known values', () => {
    expect(lnGamma(1)).toBeCloseTo(0, 14);
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 14);
    expect(lnGamma(10)).toBeCloseTo(Math.log(362880), 12);
  });
  it('erf / normal CDF reference values', () => {
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 14);
    expect(normCdf(1.959963984540054)).toBeCloseTo(0.975, 14);
    expect(normInv(0.975)).toBeCloseTo(1.959963984540054, 12);
    expect(normInv(0.995)).toBeCloseTo(2.5758293035489, 12);
    expect(normInv(1e-10)).toBeCloseTo(-6.361340902404056, 9);
  });
  it('incomplete beta symmetry I_x(a,b) = 1 - I_(1-x)(b,a)', () => {
    for (const [x, a, b] of [[0.2, 2, 3], [0.7, 0.5, 4.5], [0.01, 10, 0.5]]) {
      expect(incBeta(x, a, b) + incBeta(1 - x, b, a)).toBeCloseTo(1, 13);
    }
  });
  it('Student t CDF reference values', () => {
    expect(studentTCdf(2.228138851986273, 10)).toBeCloseTo(0.975, 13);
    expect(studentTCdf(1, 1)).toBeCloseTo(0.75, 14); // Cauchy
  });
});

describe('t-factor t_p(nu): GUM Table G.2 / NIST TN 1297 Table B.1', () => {
  // The printed tables contain one rounding slip: nu = 35, p = 90 % is printed as 1.70 but the exact
  // value is 1.6896 (-> 1.69). Verified independently below against the high-precision quantile.
  const KNOWN_TABLE_SLIPS = new Set(['35|90']);
  it('reproduces every tabulated value (2 decimals) for nu = 1..50 (155 of 156 cells; 1 known table slip)', () => {
    let checked = 0;
    for (const [nu, row] of TABLE_G2) {
      row.forEach((tab, j) => {
        if (KNOWN_TABLE_SLIPS.has(`${nu}|${P[j]}`)) return;
        checked++;
        const t = tFactor(confidencePercentToFraction(P[j]), nu);
        expect(Math.abs(t - tab), `nu=${nu}, p=${P[j]}: computed ${t}`).toBeLessThanOrEqual(0.005 + 1e-9);
      });
    }
    expect(checked).toBe(155);
  });
  it('table slip nu = 35, p = 90 %: exact t = 1.68957 (printed 1.70)', () => {
    expect(tFactor(0.9, 35)).toBeCloseTo(1.689572458, 8);
  });
  it('reproduces nu = 100 and nu = infinity rows (3 decimals)', () => {
    ROW_100.forEach((tab, j) => expect(Math.abs(tFactor(confidencePercentToFraction(P[j]), 100) - tab)).toBeLessThanOrEqual(0.0005 + 1e-9));
    ROW_INF.forEach((tab, j) => expect(Math.abs(tFactor(confidencePercentToFraction(P[j]), Infinity) - tab)).toBeLessThanOrEqual(0.0005 + 1e-9));
  });
  it('matches high-precision reference quantiles', () => {
    expect(tFactor(0.95, 1)).toBeCloseTo(12.706204736174707, 9);
    expect(tFactor(0.95, 10)).toBeCloseTo(2.228138851986273, 11);
    expect(tFactor(0.95, 30)).toBeCloseTo(2.042272456301238, 11);
    expect(tFactor(0.99, 16)).toBeCloseTo(2.920781622, 8);
  });
  it('95.45 % / 68.27 % / 99.73 % map to k = 2, 1, 3 exactly at nu = infinity (GUM G.2 note a)', () => {
    expect(tFactor(confidencePercentToFraction(95.45), Infinity)).toBeCloseTo(2, 12);
    expect(tFactor(confidencePercentToFraction(68.27), Infinity)).toBeCloseTo(1, 12);
    expect(tFactor(confidencePercentToFraction(99.73), Infinity)).toBeCloseTo(3, 12);
  });
  it('NIST TN 1297 B.2: nu_eff = 8 gives k95 = 2.3', () => {
    expect(tFactor(0.95, 8)).toBeCloseTo(2.306004135, 8);
  });
  it('handles non-integer nu (interpolation case) monotonically', () => {
    const a = tFactor(0.95, 16);
    const b = tFactor(0.95, 16.7);
    const c = tFactor(0.95, 17);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(c);
  });
  it('converges to the normal quantile for very large nu', () => {
    expect(tFactor(0.95, 1e7)).toBeCloseTo(1.959964, 5);
  });
});
