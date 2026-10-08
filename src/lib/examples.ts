import { newBudget, newComponent } from './budget';
import type { Budget } from './types';

/**
 * GUM (JCGM 100:2008) Annex H.1 - End-gauge calibration.
 * Model (H.3):  l = lS + d − lS·(δα·θ + αS·δθ)   (all lengths in mm)
 * Published: uc = 32 nm (uc² = 1002 nm²), νeff = 16.7 -> 16, t99(16) = 2.92, U99 = 93 nm.
 */
export function gumH1(): Budget {
  return newBudget({
    title: 'GUM H.1 – End-gauge calibration (worked example)',
    measurand: { name: 'Length of end gauge at 20 °C', symbol: 'l', unit: 'mm', value: 50.000838, description: 'Nominal 50 mm end gauge calibrated by comparison with a standard of the same nominal length (JCGM 100:2008, H.1).' },
    model: {
      enabled: true,
      expression: 'lS + d - lS*(dalpha*theta + alphaS*dtheta)',
      variables: [
        { name: 'lS', value: 50.000623, unit: 'mm', description: 'Length of the standard at 20 °C (certificate)' },
        { name: 'd', value: 215e-6, unit: 'mm', description: 'Mean measured difference (5 readings) = 215 nm' },
        { name: 'alphaS', value: 11.5e-6, unit: '1/°C', description: 'Thermal expansion coefficient of standard' },
        { name: 'theta', value: -0.1, unit: '°C', description: 'Deviation of bed temperature from 20 °C' },
        { name: 'dalpha', value: 0, unit: '1/°C', description: 'Difference in expansion coefficients' },
        { name: 'dtheta', value: 0, unit: '°C', description: 'Difference in temperature of the gauges' },
      ],
    },
    components: [
      newComponent({ name: 'Calibration of the standard end gauge', symbol: 'u(lS)', variable: 'lS', source: 'calibration-certificate', sourceNote: 'Certificate: U = 0.075 µm, k = 3, νeff = 18 (GUM H.1.3.1)', distribution: 'normal-k', value: 0.075e-3, k: 3, certDof: 18, unit: 'mm', sensitivityMode: 'model' }),
      newComponent({ name: 'Repeated observations of the difference', symbol: 'u(d̄)', variable: 'd', source: 'historical', sourceNote: 'Pooled s = 13 nm from 25 observations; mean of 5 readings (GUM H.1.3.2)', distribution: 'typeA-pooled', pooledSd: 13e-6, pooledDof: 24, nAveraged: 5, unit: 'mm', sensitivityMode: 'model' }),
      newComponent({ name: 'Comparator – random effects', symbol: 'u(d1)', variable: 'd', source: 'calibration-certificate', sourceNote: 'Comparator certificate: ±0.01 µm at 95 %, 6 replicates (ν = 5)', distribution: 'normal-conf', value: 0.01e-3, confidencePercent: 95, certDof: 5, unit: 'mm', sensitivityMode: 'model' }),
      newComponent({ name: 'Comparator – systematic effects', symbol: 'u(d2)', variable: 'd', source: 'calibration-certificate', sourceNote: 'Comparator certificate: 0.02 µm at "three sigma"; reliable to 25 % -> ν = 8', distribution: 'normal-k', value: 0.02e-3, k: 3, dofMode: 'reliability', reliabilityPercent: 25, unit: 'mm', sensitivityMode: 'model' }),
      newComponent({ name: 'Thermal expansion coefficient of standard', symbol: 'u(αS)', variable: 'alphaS', source: 'reference-data', sourceNote: 'αS = 11.5e-6 /°C, rectangular ±2e-6 /°C (GUM H.1.3.3)', distribution: 'rectangular', value: 2e-6, unit: '1/°C', sensitivityMode: 'model' }),
      newComponent({ name: 'Mean temperature of bed', symbol: 'u(θ̄)', variable: 'theta', source: 'environmental', sourceNote: 'Reported (19.9 ± 0.5) °C; u(θ̄) = 0.2 °C (GUM H.1.3.4)', distribution: 'normal-std', value: 0.2, unit: '°C', sensitivityMode: 'model' }),
      newComponent({ name: 'Cyclic variation of room temperature', symbol: 'u(Δ)', variable: 'theta', source: 'environmental', sourceNote: 'Cyclic ±0.5 °C, U-shaped (arcsine) (GUM H.1.3.4)', distribution: 'u-shaped', value: 0.5, unit: '°C', sensitivityMode: 'model' }),
      newComponent({ name: 'Difference in expansion coefficients', symbol: 'u(δα)', variable: 'dalpha', source: 'reference-data', sourceNote: 'Bounds ±1e-6 /°C rectangular, reliable to 10 % -> ν = 50 (GUM H.1.3.5)', distribution: 'rectangular', value: 1e-6, dofMode: 'reliability', reliabilityPercent: 10, unit: '1/°C', sensitivityMode: 'model' }),
      newComponent({ name: 'Difference in temperature of gauges', symbol: 'u(δθ)', variable: 'dtheta', source: 'environmental', sourceNote: 'Bounds ±0.05 °C rectangular, reliable to 50 % -> ν = 2 (GUM H.1.3.6)', distribution: 'rectangular', value: 0.05, dofMode: 'reliability', reliabilityPercent: 50, unit: '°C', sensitivityMode: 'model' }),
    ],
    coverage: { mode: 'confidence', confidencePercent: 99, k: 2, dofHandling: 'truncate' },
    metadata: { laboratory: 'Worked example', preparedBy: '', date: new Date().toISOString().slice(0, 10), procedure: 'JCGM 100:2008 Annex H.1', equipment: 'Comparator, standard end gauge', conditions: 'Bed temperature (19.9 ± 0.5) °C', notes: 'Published result: uc = 32 nm, νeff = 16, k = 2.92, U99 = 93 nm (GUM multiplies the rounded uc = 32 nm by 2.92).' },
  });
}

/**
 * EA-4/02 M:2022 Supplement S2 - Calibration of a 10 kg weight (OIML M1) against an F2 standard.
 * Model (S2.1): mX = mS + δmD + δm + δmC + δB   (grams).  EA uses k = 2.
 * Published (2022): u(mX) = 29.2 mg, U = 58 mg.
 */
export function eaS2(): Budget {
  return newBudget({
    title: 'EA-4/02 S2 – Calibration of a 10 kg weight (worked example)',
    measurand: { name: 'Conventional mass of the 10 kg weight', symbol: 'mX', unit: 'g', value: 10000.025, description: 'OIML class M1 weight compared with an F2 reference standard on a mass comparator.' },
    model: {
      enabled: true,
      expression: 'mS + dmD + dm + dmC + dB',
      variables: [
        { name: 'mS', value: 10000.005, unit: 'g', description: 'Conventional mass of the standard' },
        { name: 'dmD', value: 0, unit: 'g', description: 'Drift of the standard since last calibration' },
        { name: 'dm', value: 0.02, unit: 'g', description: 'Observed difference (mean of 3 comparisons)' },
        { name: 'dmC', value: 0, unit: 'g', description: 'Correction for eccentricity and magnetic effects' },
        { name: 'dB', value: 0, unit: 'g', description: 'Correction for air buoyancy' },
      ],
    },
    components: [
      newComponent({ name: 'Reference standard', symbol: 'u(mS)', variable: 'mS', source: 'calibration-certificate', sourceNote: 'Certificate: 10 000.005 g, U = 45 mg (k = 2)', distribution: 'normal-k', value: 0.045, k: 2, unit: 'g', sensitivityMode: 'model' }),
      newComponent({ name: 'Drift of the standard', symbol: 'u(δmD)', variable: 'dmD', source: 'drift', sourceNote: 'From previous calibrations: zero within ±15 mg', distribution: 'rectangular', value: 0.015, unit: 'g', sensitivityMode: 'model' }),
      newComponent({ name: 'Comparator repeatability (observed difference)', symbol: 'u(δm)', variable: 'dm', source: 'historical', sourceNote: 'Pooled s = 25 mg from earlier evaluation; mean of 3 comparisons. EA: dof "large" (50 assumed here).', distribution: 'typeA-pooled', pooledSd: 0.025, pooledDof: 50, nAveraged: 3, unit: 'g', sensitivityMode: 'model' }),
      newComponent({ name: 'Comparator eccentricity & magnetic effects', symbol: 'u(δmC)', variable: 'dmC', source: 'manufacturer-spec', sourceNote: 'Rectangular limits ±10 mg', distribution: 'rectangular', value: 0.01, unit: 'g', sensitivityMode: 'model' }),
      newComponent({ name: 'Air buoyancy', symbol: 'u(δB)', variable: 'dB', source: 'environmental', sourceNote: 'Limits ±1×10⁻⁶ of nominal value (±10 mg)', distribution: 'rectangular', value: 1, scale: 'ppm', scaleReference: 10000, unit: 'g', sensitivityMode: 'model' }),
    ],
    coverage: { mode: 'fixed-k', confidencePercent: 95.45, k: 2, dofHandling: 'truncate' },
    metadata: { laboratory: 'Worked example', preparedBy: '', date: new Date().toISOString().slice(0, 10), procedure: 'EA-4/02 M:2022 Supplement S2', equipment: 'Mass comparator, F2 10 kg standard', conditions: '', notes: 'Published (EA-4/02 M:2022): u(mX) = 29.2 mg, U = 58 mg with rounded table values; the unrounded inputs give 29.26 mg -> U = 58.5 mg.' },
  });
}

/** Illustrative (not a published example): outside-jaw calibration of a 0–150 mm digital caliper at 100 mm with a gauge block. */
export function caliperExample(): Budget {
  return newBudget({
    title: 'Digital caliper at 100 mm (illustrative)',
    measurand: { name: 'Error of indication of a 0–150 mm digital caliper at 100 mm', symbol: 'E', unit: 'mm', value: 0.003, description: 'Outside jaws measuring a 100 mm grade 0 steel gauge block. E = mean caliper reading − gauge block length. Illustrative values only.' },
    model: { enabled: false, expression: '', variables: [] },
    components: [
      newComponent({ name: 'Gauge block calibration', symbol: 'u(Lgb)', source: 'calibration-certificate', sourceNote: 'Gauge block certificate: U = 0.10 µm (k = 2)', distribution: 'normal-k', value: 0.0001, k: 2, unit: 'mm', sensitivity: -1 }),
      newComponent({ name: 'Repeatability of caliper readings', symbol: 'u(rep)', source: 'repeatability', sourceNote: '10 readings taken during this calibration', distribution: 'typeA-readings', readings: '100.00 100.01 100.00 100.00 100.01 99.99 100.00 100.01 100.00 100.01', unit: 'mm', sensitivity: 1 }),
      newComponent({ name: 'Caliper resolution', symbol: 'u(res)', source: 'resolution', sourceNote: 'Digital resolution 0.01 mm', distribution: 'resolution', value: 0.01, unit: 'mm', sensitivity: 1 }),
      newComponent({ name: 'Temperature difference caliper / gauge block', symbol: 'u(Δt)', source: 'environmental', sourceNote: 'Lab log: 20 ± 1 °C; ΔL = L·α·Δt = 100 mm × 11.5e-6/°C × 1 °C', distribution: 'rectangular', value: 0.00115, unit: 'mm', sensitivity: 1 }),
      newComponent({ name: 'Jaw flatness / parallelism (Abbe, contact)', symbol: 'u(jaw)', source: 'manufacturer-spec', sourceNote: 'Manufacturer jaw flatness ±2 µm', distribution: 'rectangular', value: 0.002, unit: 'mm', sensitivity: 1 }),
    ],
    coverage: { mode: 'confidence', confidencePercent: 95.45, k: 2, dofHandling: 'truncate' },
  });
}

export const EXAMPLES: Array<{ key: string; label: string; make: () => Budget }> = [
  { key: 'caliper', label: 'Digital caliper at 100 mm (illustrative)', make: caliperExample },
  { key: 'gum-h1', label: 'GUM H.1 end-gauge calibration', make: gumH1 },
  { key: 'ea-s2', label: 'EA-4/02 S2 10 kg weight calibration', make: eaS2 },
];
