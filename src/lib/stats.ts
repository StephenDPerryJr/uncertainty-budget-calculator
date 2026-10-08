/**
 * Statistical special functions used by the uncertainty engine.
 *
 * Everything here is computed to (near) double precision; no lookup tables.
 *  - lnGamma: Lanczos approximation (g = 7, n = 9), ~1e-15 relative accuracy.
 *  - regularized incomplete beta I_x(a,b): continued fraction (modified Lentz).
 *  - regularized incomplete gamma P(a,x): series / continued fraction.
 *  - Student t CDF and its inverse (coverage factor t_p(nu)), valid for
 *    non-integer nu (GUM G.3 / TN 1297 B.3 interpolation case) and nu = Infinity.
 *  - Normal CDF / inverse (Acklam start + Halley refinement on an accurate erfc).
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function lnGamma(x: number): number {
  if (x < 0.5) {
    // reflection formula
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-16;
const FPMIN = 1e-300;

function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  const front = Math.exp(lnFront);
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(a, b, x)) / a;
  return 1 - (front * betacf(b, a, 1 - x)) / b;
}

/** Regularized lower incomplete gamma P(a, x). */
export function incGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 10000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  return 1 - incGammaQcf(a, x);
}

function incGammaQcf(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Complementary error function, accurate in the tails. */
export function erfc(x: number): number {
  if (x < 0) return 2 - erfc(-x);
  if (x === 0) return 1;
  const x2 = x * x;
  if (x2 < 1.5) return 1 - incGammaP(0.5, x2);
  return incGammaQcf(0.5, x2);
}

export function erf(x: number): number {
  return 1 - erfc(x);
}

/** Standard normal CDF Phi(z). */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Inverse standard normal CDF (quantile). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return NaN;
  }
  // Acklam's rational approximation (rel. error ~1.15e-9) ...
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // ... refined with two Halley steps against the accurate CDF -> full double precision
  for (let i = 0; i < 2; i++) {
    const e = normCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    x = x - u / (1 + (x * u) / 2);
  }
  return x;
}

/** Two-sided central probability of Student t: P(|T| <= t) for nu degrees of freedom. */
export function studentTCentral(t: number, nu: number): number {
  if (t <= 0) return 0;
  if (!isFinite(nu)) return 1 - erfc(t / Math.SQRT2);
  const x = nu / (nu + t * t);
  return 1 - incBeta(x, nu / 2, 0.5);
}

/** One-sided Student t CDF P(T <= t). */
export function studentTCdf(t: number, nu: number): number {
  const c = studentTCentral(Math.abs(t), nu);
  return t >= 0 ? 0.5 + c / 2 : 0.5 - c / 2;
}

/**
 * t-factor t_p(nu): the value such that the interval [-t, +t] encompasses the
 * fraction p of the t-distribution with nu degrees of freedom (GUM G.3.2, Table G.2;
 * NIST TN 1297 Table B.1).  p is a fraction in (0,1).  nu may be non-integer.
 * nu = Infinity gives the normal coverage factor k_p.
 */
export function tFactor(p: number, nu: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError('coverage probability p must be in (0,1)');
  if (!(nu > 0)) throw new RangeError('degrees of freedom must be > 0');
  if (!isFinite(nu) || nu > 1e10) return normInv(0.5 + p / 2);
  // Solve I_x(nu/2, 1/2) = 1 - p for x by bisection (I_x is monotone increasing in x),
  // then t = sqrt(nu (1 - x) / x).  200 bisection steps reach machine precision.
  const target = 1 - p;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    if (incBeta(mid, nu / 2, 0.5) < target) lo = mid;
    else hi = mid;
  }
  const x = (lo + hi) / 2;
  let t = Math.sqrt((nu * (1 - x)) / x);
  // Newton polish on the central probability for full relative precision in t.
  for (let i = 0; i < 3; i++) {
    const f = studentTCentral(t, nu) - p;
    const pdf = Math.exp(lnGamma((nu + 1) / 2) - lnGamma(nu / 2) - 0.5 * Math.log(nu * Math.PI) - ((nu + 1) / 2) * Math.log1p((t * t) / nu));
    const step = f / (2 * pdf);
    if (!isFinite(step)) break;
    t -= step;
  }
  return t;
}

/**
 * Named confidence levels that, by GUM convention (Table G.2 footnote a),
 * correspond exactly to k = 1, 2, 3 for a normal distribution.
 * A user entering "95.45 %" therefore gets k = 2.000 exactly at nu = infinity.
 */
export function confidencePercentToFraction(percent: number): number {
  const exact: Array<[number, number]> = [
    [68.27, erf(1 / Math.SQRT2)],
    [95.45, erf(2 / Math.SQRT2)],
    [99.73, erf(3 / Math.SQRT2)],
  ];
  for (const [pc, frac] of exact) if (Math.abs(percent - pc) < 1e-9) return frac;
  return percent / 100;
}
