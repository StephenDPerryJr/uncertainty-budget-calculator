import { useMemo, useState, type ReactNode } from 'react';
import { confidencePercentToFraction, tFactor } from '../lib/stats';
import {
  coverageFactor,
  dofFromReliability,
  fmtDof,
  fmtNum,
  parseReadings,
  pooledStdDev,
  roundForReport,
  specHalfWidth,
  SQRT12,
  SQRT2,
  SQRT3,
  SQRT6,
  typeAStats,
  welchSatterthwaite,
} from '../lib/uncertainty';
import { Explain, NumberField, SelectField, TextField } from './inputs';

function Calc(props: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="card calc" id={props.id} data-testid={`calc-${props.id}`}>
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}
const Out = (props: { label: ReactNode; value: ReactNode }) => (
  <div className="out"><span>{props.label}</span><b>{props.value}</b></div>
);

export function Calculators() {
  return (
    <div className="calc-grid">
      <StatsCalc />
      <TCalc />
      <DivisorCalc />
      <WSCalc />
      <SpecCalc />
      <ResolutionCalc />
      <ConvertCalc />
      <PrefixCalc />
      <RoundCalc />
      <ReliabilityCalc />
      <PooledCalc />
    </div>
  );
}

function StatsCalc() {
  const [text, setText] = useState('10.01 10.02 10.00 10.01 10.03 10.01 10.02 10.00 10.01 10.02');
  const s = useMemo(() => typeAStats(parseReadings(text)), [text]);
  return (
    <Calc title="Mean, standard deviation, std dev of the mean (Type A)" id="stats">
      <TextField label="Paste readings" value={text} onChange={setText} multiline rows={3} mono />
      <div className="outs">
        <Out label="n" value={s.n} />
        <Out label="Mean x̄" value={fmtNum(s.mean, 10)} />
        <Out label="s (n−1)" value={fmtNum(s.stdDev, 5)} />
        <Out label="s/√n" value={fmtNum(s.stdDevOfMean, 5)} />
        <Out label="ν = n−1" value={s.n > 1 ? s.n - 1 : '—'} />
        <Out label="Range" value={fmtNum(s.max - s.min, 5)} />
      </div>
      <p className="muted small">GUM 4.2.1–4.2.3. Use s/√n when the reported result is the mean of these n readings; use s when it is a single reading.</p>
    </Calc>
  );
}

function TCalc() {
  const [p, setP] = useState<number | null>(95.45);
  const [nu, setNu] = useState<number | null>(10);
  let t: number | null = null;
  try { t = p && nu ? tFactor(confidencePercentToFraction(p), nu) : null; } catch { t = null; }
  const rows = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50, 100, Infinity];
  return (
    <Calc title="Coverage factor / Student t-factor tₚ(ν)" id="t">
      <div className="grid2 tight">
        <NumberField label="Level of confidence p" value={p} suffix="%" onChange={setP} />
        <NumberField label="Degrees of freedom ν (inf allowed, decimals ok)" value={nu} onChange={setNu} />
      </div>
      <Out label="tₚ(ν)" value={t !== null && Number.isFinite(t) ? t.toFixed(4) : '—'} />
      <details>
        <summary className="small">Show table for this p</summary>
        <table className="mini"><tbody>
          {rows.map((n) => <tr key={n}><td>ν = {fmtDof(n)}</td><td className="n">{p ? tFactor(confidencePercentToFraction(p), n).toFixed(3) : ''}</td></tr>)}
        </tbody></table>
      </details>
      <p className="muted small">Computed exactly from the inverse Student t-distribution (not a lookup table). 95.45 %, 68.27 % and 99.73 % give k = 2, 1, 3 for ν = ∞ (GUM Table G.2).</p>
    </Calc>
  );
}

function DivisorCalc() {
  const [v, setV] = useState<number | null>(0.05);
  const [kind, setKind] = useState<'normal' | 'rect' | 'tri' | 'u' | 'res'>('rect');
  const [k, setK] = useState<number | null>(2);
  const divisor = kind === 'normal' ? k ?? NaN : kind === 'rect' ? SQRT3 : kind === 'tri' ? SQRT6 : kind === 'u' ? SQRT2 : SQRT12;
  return (
    <Calc title="Distribution divisor → standard uncertainty" id="divisor">
      <div className="grid2 tight">
        <SelectField label="Distribution" value={kind} onChange={setKind} options={[
          { value: 'normal', label: 'Normal (U with k)' },
          { value: 'rect', label: 'Rectangular ±a  (÷√3)' },
          { value: 'tri', label: 'Triangular ±a  (÷√6)' },
          { value: 'u', label: 'U-shaped ±a  (÷√2)' },
          { value: 'res', label: 'Resolution r  (÷√12)' },
        ]} />
        <NumberField label={kind === 'normal' ? 'U' : kind === 'res' ? 'Resolution r' : 'Half-width a'} value={v} onChange={setV} />
        {kind === 'normal' ? <NumberField label="k" value={k} onChange={setK} /> : null}
      </div>
      <div className="outs">
        <Out label="Divisor" value={fmtNum(divisor, 6)} />
        <Out label="u" value={fmtNum((v ?? NaN) / divisor, 5)} />
      </div>
    </Calc>
  );
}

function WSCalc() {
  const [rows, setRows] = useState<Array<{ u: number | null; nu: number | null }>>([
    { u: 25, nu: 18 }, { u: 9.7, nu: 25.6 }, { u: 2.9, nu: 50 }, { u: 16.6, nu: 2 },
  ]);
  const [p, setP] = useState<number | null>(95.45);
  const contribs = rows.filter((r) => r.u !== null).map((r) => ({ ui: Math.abs(r.u!), dof: r.nu === null ? Infinity : r.nu }));
  const uc = Math.sqrt(contribs.reduce((s, c) => s + c.ui ** 2, 0));
  const veff = welchSatterthwaite(contribs, uc);
  let cf: { k: number; dofUsed: number } | null = null;
  try { cf = p ? coverageFactor(p, veff) : null; } catch { cf = null; }
  return (
    <Calc title="Welch–Satterthwaite effective degrees of freedom" id="ws">
      <p className="muted small">Enter each contribution |cᵢ·u(xᵢ)| and its νᵢ (blank = ∞). Pre-filled with GUM H.1 (nm).</p>
      {rows.map((r, i) => (
        <div className="grid3 tight" key={i}>
          <NumberField label={`|cᵢuᵢ| #${i + 1}`} value={r.u} allowEmpty onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, u: v } : x)))} />
          <NumberField label="νᵢ" value={r.nu} allowEmpty onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, nu: v } : x)))} />
          <button className="btn small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="btn-row">
        <button className="btn small" onClick={() => setRows([...rows, { u: null, nu: null }])}>+ Row</button>
      </div>
      <NumberField label="Level of confidence p" value={p} suffix="%" onChange={setP} />
      <div className="outs">
        <Out label="uc (RSS)" value={fmtNum(uc, 5)} />
        <Out label="νeff" value={fmtDof(veff)} />
        <Out label="k (ν truncated)" value={cf ? `${cf.k.toFixed(3)} (ν=${fmtDof(cf.dofUsed)})` : '—'} />
        <Out label="U" value={cf ? fmtNum(cf.k * uc, 4) : '—'} />
      </div>
    </Calc>
  );
}

function SpecCalc() {
  const [reading, setReading] = useState<number | null>(10);
  const [pr, setPr] = useState<number | null>(0.02);
  const [range, setRange] = useState<number | null>(20);
  const [pR, setPR] = useState<number | null>(0.005);
  const [digits, setDigits] = useState<number | null>(2);
  const [res, setRes] = useState<number | null>(0.001);
  const a = specHalfWidth({ reading: reading ?? 0, percentOfReading: pr ?? 0, range: range ?? 0, percentOfRange: pR ?? 0, digits: digits ?? 0, resolution: res ?? 0 });
  return (
    <Calc title="Manufacturer accuracy spec ±(% rdg + % range + digits)" id="spec">
      <div className="grid3 tight">
        <NumberField label="Reading" value={reading} onChange={setReading} />
        <NumberField label="% of reading" value={pr} onChange={setPr} />
        <NumberField label="Range" value={range} onChange={setRange} />
        <NumberField label="% of range" value={pR} onChange={setPR} />
        <NumberField label="Digits (counts)" value={digits} onChange={setDigits} />
        <NumberField label="Resolution (1 digit)" value={res} onChange={setRes} />
      </div>
      <div className="outs">
        <Out label="Half-width a" value={fmtNum(a, 5)} />
        <Out label="u = a/√3 (rectangular)" value={fmtNum(a / SQRT3, 5)} />
      </div>
      <p className="muted small">Use the spec for the instrument's calibration interval and temperature range. For ppm specs, 1 ppm = 0.0001 %.</p>
    </Calc>
  );
}

function ResolutionCalc() {
  const [r, setR] = useState<number | null>(0.01);
  const [frac, setFrac] = useState<'digital' | 'half' | 'fifth'>('digital');
  const half = frac === 'digital' ? (r ?? NaN) / 2 : frac === 'half' ? (r ?? NaN) / 4 : (r ?? NaN) / 10;
  return (
    <Calc title="Resolution half-interval" id="resolution">
      <div className="grid2 tight">
        <NumberField label="Resolution / graduation r" value={r} onChange={setR} />
        <SelectField label="Indication" value={frac} onChange={setFrac} options={[
          { value: 'digital', label: 'Digital: ±r/2' },
          { value: 'half', label: 'Analog read to ½ division: ±r/4' },
          { value: 'fifth', label: 'Analog read to ⅕ division: ±r/10' },
        ]} />
      </div>
      <div className="outs">
        <Out label="Half-interval a" value={fmtNum(half, 5)} />
        <Out label="u = a/√3" value={fmtNum(half / SQRT3, 5)} />
      </div>
    </Calc>
  );
}

function ConvertCalc() {
  const [v, setV] = useState<number | null>(10);
  const [from, setFrom] = useState<'abs' | 'pct' | 'ppm' | 'ppb'>('ppm');
  const [ref, setRef] = useState<number | null>(100);
  const factor = { abs: 1, pct: 1e-2, ppm: 1e-6, ppb: 1e-9 }[from];
  const abs = from === 'abs' ? v ?? NaN : (v ?? NaN) * factor * Math.abs(ref ?? NaN);
  const rel = abs / Math.abs(ref ?? NaN);
  return (
    <Calc title="% / ppm / ppb ↔ absolute" id="convert">
      <div className="grid3 tight">
        <NumberField label="Value" value={v} onChange={setV} />
        <SelectField label="Expressed as" value={from} onChange={setFrom} options={[{ value: 'abs', label: 'Absolute' }, { value: 'pct', label: '%' }, { value: 'ppm', label: 'ppm' }, { value: 'ppb', label: 'ppb' }]} />
        <NumberField label="Of reference value" value={ref} onChange={setRef} />
      </div>
      <div className="outs">
        <Out label="Absolute" value={fmtNum(abs, 6)} />
        <Out label="%" value={fmtNum(rel * 100, 6)} />
        <Out label="ppm" value={fmtNum(rel * 1e6, 6)} />
      </div>
    </Calc>
  );
}

const PREFIX: Array<[string, number]> = [['T', 1e12], ['G', 1e9], ['M', 1e6], ['k', 1e3], ['(none)', 1], ['m', 1e-3], ['µ', 1e-6], ['n', 1e-9], ['p', 1e-12]];
function PrefixCalc() {
  const [v, setV] = useState<number | null>(0.075);
  const [from, setFrom] = useState('µ');
  const [to, setTo] = useState('n');
  const f = PREFIX.find((p) => p[0] === from)![1] / PREFIX.find((p) => p[0] === to)![1];
  const opts = PREFIX.map(([p]) => ({ value: p, label: p }));
  return (
    <Calc title="SI prefix conversion (e.g. µm → nm, mV → V)" id="prefix">
      <div className="grid3 tight">
        <NumberField label="Value" value={v} onChange={setV} />
        <SelectField label="From prefix" value={from} onChange={setFrom} options={opts} />
        <SelectField label="To prefix" value={to} onChange={setTo} options={opts} />
      </div>
      <Out label="Result" value={fmtNum((v ?? NaN) * f, 8)} />
    </Calc>
  );
}

function RoundCalc() {
  const [y, setY] = useState<number | null>(10.05762);
  const [U, setU] = useState<number | null>(0.0273);
  const [mode, setMode] = useState<'nearest' | 'up'>('nearest');
  const r = y !== null && U !== null && U > 0 ? roundForReport(y, U, U, mode) : null;
  return (
    <Calc title="Round reported uncertainty (GUM 7.2.6)" id="round">
      <div className="grid3 tight">
        <NumberField label="Result y" value={y} onChange={setY} />
        <NumberField label="Expanded uncertainty U" value={U} onChange={setU} />
        <SelectField label="Mode" value={mode} onChange={setMode} options={[{ value: 'nearest', label: 'Nearest' }, { value: 'up', label: 'Round up' }]} />
      </div>
      <Out label="Report" value={r ? `${r.ytext} ± ${r.Utext}` : '—'} />
      <p className="muted small">U to two significant digits; y rounded to the same decimal place.</p>
    </Calc>
  );
}

function ReliabilityCalc() {
  const [r, setR] = useState<number | null>(25);
  return (
    <Calc title="Type B degrees of freedom from reliability (GUM G.4.2)" id="reliability">
      <NumberField label="Estimated relative uncertainty of u, Δu/u" value={r} suffix="%" onChange={setR} />
      <Out label="ν = ½ (Δu/u)⁻²" value={fmtDof(dofFromReliability(r ?? 0))} />
      <p className="muted small">GUM example: 25 % → ν = 8; 10 % → 50; 50 % → 2.</p>
    </Calc>
  );
}

function PooledCalc() {
  const [text, setText] = useState('5 0.012\n5 0.015\n10 0.011');
  const groups = text.split(/\n+/).map((l) => l.trim().split(/[\s,;]+/).map(Number)).filter((a) => a.length >= 2 && a.every(Number.isFinite)).map(([n, s]) => ({ n, s }));
  const p = pooledStdDev(groups);
  return (
    <Calc title="Pooled standard deviation" id="pooled">
      <TextField label="One group per line: n  s" value={text} onChange={setText} multiline rows={3} mono />
      <div className="outs">
        <Out label="s_p" value={fmtNum(p.sp, 5)} />
        <Out label="ν = Σ(nᵢ−1)" value={p.dof} />
      </div>
      <Explain>Use s_p in a “Type A – pooled” component; divide by √m for the number of readings averaged now.</Explain>
    </Calc>
  );
}
