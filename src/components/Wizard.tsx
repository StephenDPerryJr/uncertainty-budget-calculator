import { useMemo, useState } from 'react';
import { newComponent } from '../lib/budget';
import { compileModel, SUPPORTED_FUNCTIONS } from '../lib/expr';
import { COMPONENT_CHECKLIST, DISTRIBUTIONS, SOURCES, STEPS } from '../lib/guidance';
import type { Budget, BudgetResult, Component } from '../lib/types';
import { fmtNum } from '../lib/uncertainty';
import { BudgetTable } from './BudgetTable';
import { ComponentEditor } from './ComponentEditor';
import { Checkbox, Explain, NumberField, TextField } from './inputs';
import { CoverageSettings, ResultsPanel } from './ResultsPanel';

type Update = (fn: (b: Budget) => Budget) => void;

export function Wizard(props: { budget: Budget; result: BudgetResult; update: Update; onExport: (kind: 'csv' | 'json' | 'report') => void }) {
  const [step, setStep] = useState(0);
  const { budget, result, update } = props;
  return (
    <div className="wizard">
      <ol className="stepper" data-testid="stepper">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i === step ? 'active' : i < step ? 'done' : ''}>
            <button onClick={() => setStep(i)}>
              <span className="num">{i + 1}</span>
              <span className="lbl">{s.title.replace(/^\d\.\s*/, '')}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="step-intro">
        <h2>{STEPS[step].title}</h2>
        <p>{STEPS[step].blurb}</p>
      </div>
      {step === 0 && <MeasurandStep budget={budget} update={update} />}
      {step === 1 && <ComponentsStep budget={budget} result={result} update={update} />}
      {step === 2 && <DataStep budget={budget} result={result} update={update} />}
      {step === 3 && <ReviewStep budget={budget} result={result} update={update} />}
      {step === 4 && (
        <>
          <ResultsPanel budget={budget} result={result} />
          <div className="card">
            <h3>Export</h3>
            <p>Produce the audit-ready report (print it or save as PDF from the print dialog), a CSV of the full budget table, or the budget file (JSON) to archive with the calibration records.</p>
            <div className="btn-row">
              <button className="btn primary" onClick={() => props.onExport('report')}>Open printable report</button>
              <button className="btn" onClick={() => props.onExport('csv')}>Download CSV</button>
              <button className="btn" onClick={() => props.onExport('json')}>Download budget (JSON)</button>
            </div>
          </div>
        </>
      )}
      <div className="wizard-nav">
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</button>
        <span className="muted small">Step {step + 1} of {STEPS.length} · changes are saved automatically in this browser</span>
        <button className="btn primary" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)} data-testid="next">Next →</button>
      </div>
    </div>
  );
}

function MeasurandStep({ budget: b, update }: { budget: Budget; update: Update }) {
  const setM = (patch: Partial<Budget['measurand']>) => update((x) => ({ ...x, measurand: { ...x.measurand, ...patch } }));
  const setMeta = (patch: Partial<Budget['metadata']>) => update((x) => ({ ...x, metadata: { ...x.metadata, ...patch } }));
  const parsed = useMemo(() => {
    if (!b.model.enabled || !b.model.expression.trim()) return { vars: [] as string[], error: null as string | null, value: null as number | null };
    try {
      const m = compileModel(b.model.expression);
      const vals: Record<string, number> = {};
      b.model.variables.forEach((v) => (vals[v.name] = v.value));
      let value: number | null = null;
      try { value = m.evaluate(vals); } catch { value = null; }
      return { vars: m.variables, error: null, value };
    } catch (e) {
      return { vars: [], error: (e as Error).message, value: null };
    }
  }, [b.model]);

  const syncVariables = (expression: string) => {
    update((x) => {
      let names: string[] = [];
      try { names = compileModel(expression).variables; } catch { names = []; }
      const existing = new Map(x.model.variables.map((v) => [v.name, v]));
      const vars = [...x.model.variables];
      for (const n of names) if (!existing.has(n)) vars.push({ name: n, value: 0, unit: '', description: '' });
      return { ...x, model: { ...x.model, expression, variables: vars } };
    });
  };

  return (
    <div className="stack">
      <Explain title="What is the measurand?">
        The measurand is the specific quantity you intend to measure, defined well enough that its value is unique (GUM 3.1.1, B.2.9) – e.g. “error of indication of the caliper at 100 mm, 20 °C, outside jaws”. Include conditions such as temperature and the measuring point.
      </Explain>
      <div className="card">
        <div className="grid3">
          <TextField label="Budget title" value={b.title} onChange={(v) => update((x) => ({ ...x, title: v }))} testId="title" />
          <TextField label="Measurand (what is measured)" value={b.measurand.name} onChange={(v) => setM({ name: v })} placeholder="Length of gauge block at 20 °C" />
          <div className="grid2 tight">
            <TextField label="Symbol" value={b.measurand.symbol} onChange={(v) => setM({ symbol: v })} />
            <TextField label="Unit" value={b.measurand.unit} onChange={(v) => setM({ unit: v })} />
          </div>
        </div>
        <TextField label="Description / conditions" value={b.measurand.description} onChange={(v) => setM({ description: v })} multiline rows={2} />
      </div>

      <div className="card">
        <Checkbox label={<b>Use a mathematical measurement model Y = f(X₁, X₂, …)</b>} checked={b.model.enabled} onChange={(v) => update((x) => ({ ...x, model: { ...x.model, enabled: v } }))} />
        <Explain>
          A model lets the app compute every sensitivity coefficient cᵢ = ∂f/∂xᵢ for you (GUM 4.1, 5.1.3). Typical forms: <code>L_std + d</code>, <code>R_s * (1 + alpha*(t - 20))</code>, <code>V^2/R</code>. Without a model, enter the result value and give each component a cᵢ (usually 1 when the component is already in the unit of the result).
        </Explain>
        {b.model.enabled ? (
          <>
            <TextField
              label={`Model: ${b.measurand.symbol || 'Y'} =`}
              value={b.model.expression}
              onChange={syncVariables}
              mono
              testId="model-expr"
              hint={<>Operators + − * / ^ and ( ). Functions: {SUPPORTED_FUNCTIONS.join(', ')}; constant pi.</>}
            />
            {parsed.error ? <p className="err">⚠ {parsed.error}</p> : null}
            <div className="table-wrap">
              <table className="vars">
                <thead><tr><th>Variable</th><th>Estimate (best value)</th><th>Unit</th><th>Description / source</th><th></th></tr></thead>
                <tbody>
                  {b.model.variables.map((v, i) => {
                    const used = parsed.vars.includes(v.name);
                    const setV = (patch: Partial<typeof v>) => update((x) => ({ ...x, model: { ...x.model, variables: x.model.variables.map((y, j) => (j === i ? { ...y, ...patch } : y)) } }));
                    return (
                      <tr key={v.name + i} className={used ? '' : 'row-muted'}>
                        <td className="mono">{v.name}{used ? '' : <div className="small muted">not in model</div>}</td>
                        <td><NumberField label="" value={v.value} onChange={(val) => setV({ value: val ?? 0 })} /></td>
                        <td><TextField label="" value={v.unit} onChange={(val) => setV({ unit: val })} /></td>
                        <td><TextField label="" value={v.description} onChange={(val) => setV({ description: val })} /></td>
                        <td>{used ? null : <button className="btn small" onClick={() => update((x) => ({ ...x, model: { ...x.model, variables: x.model.variables.filter((_, j) => j !== i) } }))}>Delete</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>Model value: <b>{parsed.value !== null && Number.isFinite(parsed.value) ? fmtNum(parsed.value, 10) : '—'}</b> {b.measurand.unit}</p>
          </>
        ) : (
          <NumberField label={`Measured value / result (${b.measurand.unit || 'unit'})`} value={b.measurand.value} onChange={(v) => setM({ value: v ?? 0 })} hint="Used for the reported result and for % / ppm specifications." />
        )}
      </div>

      <div className="card">
        <h3>Record details (appear on the report)</h3>
        <div className="grid3">
          <TextField label="Laboratory" value={b.metadata.laboratory} onChange={(v) => setMeta({ laboratory: v })} />
          <TextField label="Prepared by" value={b.metadata.preparedBy} onChange={(v) => setMeta({ preparedBy: v })} />
          <TextField label="Date" value={b.metadata.date} onChange={(v) => setMeta({ date: v })} />
          <TextField label="Procedure / method" value={b.metadata.procedure} onChange={(v) => setMeta({ procedure: v })} />
          <TextField label="Equipment (standards, UUT)" value={b.metadata.equipment} onChange={(v) => setMeta({ equipment: v })} />
          <TextField label="Environmental conditions" value={b.metadata.conditions} onChange={(v) => setMeta({ conditions: v })} />
        </div>
      </div>
    </div>
  );
}

function ComponentsStep({ budget: b, result, update }: { budget: Budget; result: BudgetResult; update: Update }) {
  const add = (c: Partial<Component>) => update((x) => ({ ...x, components: [...x.components, newComponent({ unit: x.measurand.unit, ...c })] }));
  return (
    <div className="stack">
      <Explain title="Think through every influence">
        Walk through the measurement: the reference standard (calibration and drift), the unit under test (resolution, repeatability), the environment (temperature, humidity, pressure), the method and set-up, and the operator. ISO/IEC 17025 7.6 requires that all contributions of significance are identified; ILAC P14 requires the unit-under-test contributions (e.g. resolution, repeatability) to be included in calibration uncertainty. Click a typical source to add it.
      </Explain>
      <div className="chips">
        {COMPONENT_CHECKLIST.map((it) => (
          <button key={it.name} className="chip" title={it.hint} onClick={() => add({ name: it.name, source: it.source, distribution: it.distribution, sensitivityMode: b.model.enabled ? 'model' : 'manual' })}>
            + {it.name}
          </button>
        ))}
        <button className="chip ghost" onClick={() => add({ sensitivityMode: b.model.enabled ? 'model' : 'manual' })}>+ Blank component</button>
      </div>
      <div className="card">
        <h3>Components in this budget ({b.components.length})</h3>
        {b.components.length === 0 ? <p className="muted">No components yet.</p> : null}
        <ul className="comp-list">
          {b.components.map((c, i) => (
            <li key={c.id}>
              <span className="badge">{result.components[i]?.type ?? '?'}</span>
              <input className="inline" value={c.name} onChange={(e) => update((x) => ({ ...x, components: x.components.map((y) => (y.id === c.id ? { ...y, name: e.target.value } : y)) }))} />
              <span className="muted small">{SOURCES[c.source].label} · {DISTRIBUTIONS[c.distribution].short}</span>
              <span className="actions">
                <button className="btn small" disabled={i === 0} onClick={() => update((x) => { const a = [...x.components]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...x, components: a }; })}>↑</button>
                <button className="btn small" disabled={i === b.components.length - 1} onClick={() => update((x) => { const a = [...x.components]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { ...x, components: a }; })}>↓</button>
                <button className="btn small danger" onClick={() => update((x) => ({ ...x, components: x.components.filter((y) => y.id !== c.id), correlations: x.correlations.filter((r) => r.a !== c.id && r.b !== c.id) }))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DataStep({ budget: b, result, update }: { budget: Budget; result: BudgetResult; update: Update }) {
  const [sel, setSel] = useState(0);
  const idx = Math.min(sel, Math.max(0, b.components.length - 1));
  const c = b.components[idx];
  if (!c) return <Explain tone="warn">Add components in step 2 first.</Explain>;
  return (
    <div className="data-step">
      <aside className="comp-nav">
        {b.components.map((x, i) => (
          <button key={x.id} className={i === idx ? 'active' : ''} onClick={() => setSel(i)}>
            <span className={`dot ${result.components[i]?.errors.length ? 'bad' : 'ok'}`} />
            {i + 1}. {x.name}
            <small>{DISTRIBUTIONS[x.distribution].short} · u = {fmtNum(result.components[i]?.ui, 3)}</small>
          </button>
        ))}
      </aside>
      <div>
        <ComponentEditor
          budget={b}
          component={c}
          result={result.components[idx]}
          onChange={(nc) => update((x) => ({ ...x, components: x.components.map((y) => (y.id === nc.id ? nc : y)) }))}
          onRemove={() => update((x) => ({ ...x, components: x.components.filter((y) => y.id !== c.id) }))}
        />
        <div className="btn-row">
          <button className="btn" disabled={idx === 0} onClick={() => setSel(idx - 1)}>← Previous component</button>
          <button className="btn" disabled={idx >= b.components.length - 1} onClick={() => setSel(idx + 1)}>Next component →</button>
        </div>
      </div>
    </div>
  );
}

export function ReviewStep({ budget: b, result, update }: { budget: Budget; result: BudgetResult; update: Update }) {
  return (
    <div className="stack">
      <BudgetTable budget={b} result={result} />
      <div className="card">
        <h3>Coverage and rounding</h3>
        <CoverageSettings budget={b} update={update} />
        <Explain>
          The coverage factor is the Student-t value t<sub>p</sub>(ν<sub>eff</sub>), where ν<sub>eff</sub> comes from the Welch–Satterthwaite formula (GUM G.4.1, TN 1297 B.3). With large ν<sub>eff</sub>, 95.45 % gives k = 2.00; small ν<sub>eff</sub> (few readings dominating) gives a larger k. Accredited labs normally report at approximately 95 % (ILAC P14).
        </Explain>
      </div>
      <CorrelationEditor budget={b} update={update} />
    </div>
  );
}

function CorrelationEditor({ budget: b, update }: { budget: Budget; update: Update }) {
  const [a, setA] = useState('');
  const [c2, setC2] = useState('');
  return (
    <details className="card">
      <summary><b>Correlated inputs (optional, advanced)</b></summary>
      <Explain>
        Use only when two inputs share a common cause – e.g. two resistors calibrated against the same standard, or two readings with the same instrument where the same error applies (GUM 5.2). r = +1 means fully positively correlated. Most budgets have none.
      </Explain>
      <ul>
        {b.correlations.map((cc, i) => (
          <li key={i} className="corr-row">
            r({b.components.find((x) => x.id === cc.a)?.name ?? '?'}, {b.components.find((x) => x.id === cc.b)?.name ?? '?'}) =
            <NumberField label="" value={cc.r} onChange={(v) => update((x) => ({ ...x, correlations: x.correlations.map((y, j) => (j === i ? { ...y, r: v ?? 0 } : y)) }))} />
            <button className="btn small danger" onClick={() => update((x) => ({ ...x, correlations: x.correlations.filter((_, j) => j !== i) }))}>✕</button>
          </li>
        ))}
      </ul>
      <div className="grid3">
        <select value={a} onChange={(e) => setA(e.target.value)}><option value="">Component A…</option>{b.components.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select value={c2} onChange={(e) => setC2(e.target.value)}><option value="">Component B…</option>{b.components.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <button className="btn" disabled={!a || !c2 || a === c2} onClick={() => update((x) => ({ ...x, correlations: [...x.correlations, { a, b: c2, r: 1 }] }))}>Add correlation</button>
      </div>
    </details>
  );
}
