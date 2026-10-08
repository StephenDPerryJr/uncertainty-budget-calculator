import type { DistributionKind, SourceType } from './types';

export interface DistInfo {
  label: string;
  short: string;
  type: 'A' | 'B';
  divisor: string;
  valueLabel: string;
  whenToUse: string;
  examples: string;
  reference: string;
}

export const DISTRIBUTIONS: Record<DistributionKind, DistInfo> = {
  'normal-k': {
    label: 'Normal – expanded uncertainty with coverage factor k',
    short: 'Normal (U, k)',
    type: 'B',
    divisor: 'k',
    valueLabel: 'Expanded uncertainty U (as stated)',
    whenToUse: 'Use when a calibration certificate (or another budget) states an expanded uncertainty U together with its coverage factor k. Divide U by the stated k – do not assume k = 2 unless the certificate says so.',
    examples: 'Reference standard certificate "U = 0.10 µm, k = 2"; certificate stating "k = 2.13 for νeff = 15" (enter νeff too).',
    reference: 'GUM 4.3.3; NIST TN 1297 4.6; EA-4/02 3.3',
  },
  'normal-conf': {
    label: 'Normal – expanded uncertainty at a stated confidence level',
    short: 'Normal (U, p %)',
    type: 'B',
    divisor: 't_p(ν) or z_p',
    valueLabel: 'Expanded uncertainty / interval half-width (as stated)',
    whenToUse: 'Use when the source quotes an uncertainty "at 95 % confidence" (or 99 %, …) without k. If the degrees of freedom are stated, the divisor is the Student-t factor t_p(ν); otherwise the normal factor (1.960 for 95 %).',
    examples: 'Comparator certificate "±0.01 µm at 95 %, based on 6 replicates" (ν = 5, divisor 2.57).',
    reference: 'GUM 4.3.4, H.1.3.2; NIST TN 1297 4.6',
  },
  'normal-std': {
    label: 'Normal – standard uncertainty (1 σ) given directly',
    short: 'Standard uncertainty',
    type: 'B',
    divisor: '1',
    valueLabel: 'Standard uncertainty u (1 σ)',
    whenToUse: 'Use when the source already gives a standard uncertainty or a one-standard-deviation value (e.g. "1 σ", "k = 1"), or for a value carried over from another budget.',
    examples: 'Reference data quoted as "± 0.2 °C (1 σ)"; a sub-budget result u = 9.7 nm.',
    reference: 'GUM 4.3.3',
  },
  rectangular: {
    label: 'Rectangular (uniform) – limits ±a',
    short: 'Rectangular',
    type: 'B',
    divisor: '√3',
    valueLabel: 'Half-width a of the limits (±a)',
    whenToUse: 'The default when you only know limits and every value inside them is equally likely: manufacturer accuracy specifications, tolerances, handbook bounds, drift limits, max-min of environmental records. Conservative when in doubt.',
    examples: 'DMM spec ±(0.02 % rdg + 2 digits); thermal expansion coefficient 11.5 ± 2 ×10⁻⁶ /°C; drift "within ±15 mg".',
    reference: 'GUM 4.3.7 eq. (7); NIST TN 1297 4.6; EA-4/02 3.3.3',
  },
  triangular: {
    label: 'Triangular – limits ±a, central values more likely',
    short: 'Triangular',
    type: 'B',
    divisor: '√6',
    valueLabel: 'Half-width a of the limits (±a)',
    whenToUse: 'Use when values near the centre of the limits are clearly more likely than values near the bounds, e.g. the difference of two rectangular quantities of equal width, or well-controlled conditions that rarely reach their limits.',
    examples: 'Difference of two independent uniform quantities; a controlled bath that only occasionally reaches its limits.',
    reference: 'GUM 4.3.9',
  },
  'u-shaped': {
    label: 'U-shaped (arcsine) – values near the limits more likely',
    short: 'U-shaped',
    type: 'B',
    divisor: '√2',
    valueLabel: 'Half-width a (amplitude) of the variation',
    whenToUse: 'Use for quantities that cycle sinusoidally between limits so that they spend most time near the extremes: room temperature under a thermostat (on/off cycling), RF mismatch, periodic oscillation.',
    examples: 'Lab air temperature cycling ±0.5 °C (GUM H.1.3.4: 0.5/√2 = 0.35 °C); RF mismatch uncertainty.',
    reference: 'GUM H.1.3.4 (U-shaped temperature cycling)',
  },
  resolution: {
    label: 'Resolution of a digital indication (rectangular, r/2)',
    short: 'Resolution',
    type: 'B',
    divisor: '√12 (= 2√3)',
    valueLabel: 'Resolution r (one least-significant digit)',
    whenToUse: 'Use for the finite resolution of a digital display (or the smallest graduation you can read on an analog scale). The reading is uncertain by ±r/2 with equal probability, so u = (r/2)/√3 = r/√12. Include the resolution of the unit under test and, where relevant, of the standard.',
    examples: 'Caliper resolution 0.01 mm → u = 0.0029 mm; DMM last digit 1 µV → u = 0.29 µV.',
    reference: 'GUM F.2.2.1; ILAC P14 (contribution of the device under calibration)',
  },
  'typeA-readings': {
    label: 'Type A – repeated readings (statistics)',
    short: 'Type A (readings)',
    type: 'A',
    divisor: '√n (std dev of the mean)',
    valueLabel: 'Readings',
    whenToUse: 'Use for repeatability measured during this calibration. Paste the readings; the app computes the mean, the experimental standard deviation s (n−1) and s/√n. Degrees of freedom ν = n − 1. If the reported result is a single reading (not the mean), set "readings averaged" to 1.',
    examples: '10 repeated caliper readings on the same gauge block; 5 repeated comparisons.',
    reference: 'GUM 4.2.1–4.2.3; NIST TN 1297 3.4, A.3',
  },
  'typeA-pooled': {
    label: 'Type A – pooled / historical standard deviation',
    short: 'Type A (pooled)',
    type: 'A',
    divisor: '√m (readings averaged)',
    valueLabel: 'Pooled standard deviation s_p',
    whenToUse: 'Use when repeatability was characterised earlier (method validation, control charts, previous calibrations) and is applied to the current measurement with only a few readings. ν = degrees of freedom of the pooled estimate (Σ(nᵢ−1)), which is usually large.',
    examples: 'GUM H.1: pooled s = 13 nm from 25 observations, 5 readings now → u = 13/√5 = 5.8 nm, ν = 24.',
    reference: 'GUM 4.2.4, H.1.3.2, H.3.6; EA-4/02 S2',
  },
};

export const DIST_ORDER: DistributionKind[] = ['normal-k', 'normal-conf', 'normal-std', 'rectangular', 'triangular', 'u-shaped', 'resolution', 'typeA-readings', 'typeA-pooled'];

export interface SourceInfo {
  label: string;
  where: string;
  suggested: DistributionKind;
}

export const SOURCES: Record<SourceType, SourceInfo> = {
  'calibration-certificate': { label: 'Calibration certificate of the reference standard', where: 'The certificate from your accredited calibration provider (ISO/IEC 17025, ILAC-MRA). Look for the expanded uncertainty U, the coverage factor k (or confidence level) and, if given, the effective degrees of freedom.', suggested: 'normal-k' },
  'manufacturer-spec': { label: 'Manufacturer specification', where: 'Instrument manual / datasheet accuracy specification, e.g. ±(% of reading + % of range + digits), for the stated calibration interval and temperature range.', suggested: 'rectangular' },
  repeatability: { label: 'Repeatability (this measurement)', where: 'Repeated readings taken during this calibration/test under the same conditions (Type A).', suggested: 'typeA-readings' },
  reproducibility: { label: 'Reproducibility (operators, days, set-ups)', where: 'Method validation studies, gauge R&R, inter-operator comparisons, ANOVA of historical data.', suggested: 'typeA-pooled' },
  historical: { label: 'Historical / pooled data', where: 'Control charts, check-standard records, previous calibrations, pooled standard deviations from validation.', suggested: 'typeA-pooled' },
  environmental: { label: 'Environmental conditions', where: 'Environmental monitoring records (temperature, humidity, pressure logs) and the sensitivity of the measurement to them (e.g. thermal expansion L·α·Δt).', suggested: 'rectangular' },
  resolution: { label: 'Resolution of the indication', where: 'Display resolution of the unit under test or of the standard (one least significant digit) or the readable graduation of an analog scale.', suggested: 'resolution' },
  drift: { label: 'Drift / stability of the reference standard', where: 'History of the standard\'s calibration certificates (change in value between calibrations), manufacturer stability spec.', suggested: 'rectangular' },
  'reference-data': { label: 'Reference data / handbooks', where: 'Published constants and material properties (e.g. thermal expansion coefficients), NIST databases, handbooks.', suggested: 'rectangular' },
  method: { label: 'Method / set-up effects', where: 'Fixturing, alignment (Abbe/cosine error), loading effects, lead resistance, probe/contact effects; estimated from experiments or engineering limits.', suggested: 'rectangular' },
  other: { label: 'Other', where: 'Any other influence identified in the measurement model or by a cause-and-effect (fishbone) review.', suggested: 'rectangular' },
};

/** Typical components offered as one-click starters in step 2. */
export const COMPONENT_CHECKLIST: Array<{ name: string; source: SourceType; distribution: DistributionKind; hint: string }> = [
  { name: 'Reference standard calibration', source: 'calibration-certificate', distribution: 'normal-k', hint: 'Almost always required. From the standard\'s certificate: U and k.' },
  { name: 'Reference standard drift / stability', source: 'drift', distribution: 'rectangular', hint: 'Change between successive calibrations of the standard.' },
  { name: 'Repeatability (Type A)', source: 'repeatability', distribution: 'typeA-readings', hint: 'Repeated readings now, or a pooled standard deviation.' },
  { name: 'Resolution of unit under test', source: 'resolution', distribution: 'resolution', hint: 'Required by ILAC P14 for the UUT contribution.' },
  { name: 'Resolution of reference standard', source: 'resolution', distribution: 'resolution', hint: 'If the standard has a display.' },
  { name: 'Temperature effects', source: 'environmental', distribution: 'rectangular', hint: 'Lab temperature limits × sensitivity (e.g. L·α·Δt).' },
  { name: 'Temperature cycling', source: 'environmental', distribution: 'u-shaped', hint: 'Thermostat cycling between limits.' },
  { name: 'Reference standard accuracy (spec)', source: 'manufacturer-spec', distribution: 'rectangular', hint: 'Use when the standard is used to its spec rather than its certificate value.' },
  { name: 'Reproducibility (operator / set-up)', source: 'reproducibility', distribution: 'typeA-pooled', hint: 'From R&R or validation data.' },
  { name: 'Fixture / alignment / method effect', source: 'method', distribution: 'rectangular', hint: 'Engineering estimate of limits.' },
];

export const STEPS = [
  { key: 'measurand', title: '1. Measurand & model', blurb: 'Say exactly what you are measuring and how the result is calculated.' },
  { key: 'components', title: '2. Uncertainty sources', blurb: 'List every influence that can change the result.' },
  { key: 'data', title: '3. Quantify each source', blurb: 'Enter the data, pick the distribution, get the standard uncertainty.' },
  { key: 'review', title: '4. Review budget', blurb: 'Check sensitivities, degrees of freedom and contributions.' },
  { key: 'results', title: '5. Results & report', blurb: 'Combined and expanded uncertainty, reporting statement, export.' },
] as const;

export const REFERENCES = [
  'JCGM 100:2008 (GUM 1995 with minor corrections), Evaluation of measurement data – Guide to the expression of uncertainty in measurement.',
  'NIST Technical Note 1297 (1994), B. N. Taylor & C. E. Kuyatt, Guidelines for Evaluating and Expressing the Uncertainty of NIST Measurement Results.',
  'ISO/IEC 17025:2017, General requirements for the competence of testing and calibration laboratories, clause 7.6 (evaluation of measurement uncertainty) and 7.8.4 (calibration certificates).',
  'ILAC P14:09/2020, ILAC Policy for Measurement Uncertainty in Calibration.',
  'EA-4/02 M:2022, Evaluation of the Uncertainty of Measurement in Calibration.',
];

export const METHOD_STATEMENT =
  'Uncertainty evaluated per JCGM 100:2008 (GUM) and NIST TN 1297: standard uncertainties from Type A (statistical) and Type B evaluations, ' +
  'combined by the law of propagation of uncertainty (first-order Taylor series, GUM 5.1.2 / 5.2.2), effective degrees of freedom by the ' +
  'Welch–Satterthwaite formula (GUM G.4.1), coverage factor from the Student t-distribution (GUM G.3/G.6.4), and reported to two significant digits (GUM 7.2.6).';
