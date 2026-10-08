import { useMemo, useRef, useState } from 'react';
import { BudgetTable } from './components/BudgetTable';
import { Calculators } from './components/Calculators';
import { ComponentEditor } from './components/ComponentEditor';
import { Explain } from './components/inputs';
import { CoverageSettings, ResultsPanel } from './components/ResultsPanel';
import { Wizard } from './components/Wizard';
import { newBudget, normalizeBudget, uid } from './lib/budget';
import { EXAMPLES } from './lib/examples';
import { DISTRIBUTIONS, DIST_ORDER, METHOD_STATEMENT, REFERENCES } from './lib/guidance';
import { budgetToCSV, budgetToHTML } from './lib/report';
import { computeBudget, fmtNum } from './lib/uncertainty';
import { downloadFile, safeFileName, useBudgetStore } from './store';
import type { Budget, BudgetResult } from './lib/types';

type Tab = 'wizard' | 'table' | 'calculators' | 'report' | 'library' | 'guide';
const TABS: Array<[Tab, string]> = [
  ['wizard', 'Guided wizard'],
  ['table', 'Budget table'],
  ['calculators', 'Calculators'],
  ['report', 'Report'],
  ['library', 'My budgets'],
  ['guide', 'Guide & references'],
];


interface Ctx {
  budget: Budget;
  result: BudgetResult;
  update: (fn: (b: Budget) => Budget) => void;
  store: ReturnType<typeof useBudgetStore>;
  doExport: (kind: 'csv' | 'json' | 'report') => void;
  setTab: (t: Tab) => void;
  say: (m: string) => void;
}

export default function App() {
  const store = useBudgetStore();
  const { budget, update } = store;
  const result = useMemo(() => computeBudget(budget), [budget]);
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'wizard');
  const [flash, setFlash] = useState<string | null>(null);
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2500); };

  const doExport = (kind: 'csv' | 'json' | 'report') => {
    const base = safeFileName(budget.title);
    if (kind === 'csv') downloadFile(`${base}.csv`, budgetToCSV(budget, result), 'text/csv;charset=utf-8');
    else if (kind === 'json') downloadFile(`${base}.budget.json`, JSON.stringify(budget, null, 2), 'application/json');
    else setTab('report');
  };

  const ctx: Ctx = { budget, result, update, store, doExport, setTab, say };

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <span className="logo">±U</span>
          <div>
            <h1>Uncertainty Budget Calculator <em>Made Simple</em></h1>
            <p>GUM (JCGM 100:2008) · NIST TN 1297 · ISO/IEC 17025</p>
          </div>
        </div>
        <div className="current">
          <input className="title-input" value={budget.title} onChange={(e) => update((b) => ({ ...b, title: e.target.value }))} aria-label="Budget title" />
          <span className={`pill ${result.errors.length ? 'bad' : 'ok'}`} data-testid="headline">
            {result.reported ? `U = ${result.reported.Utext} ${budget.measurand.unit} (k = ${result.k.toFixed(2)})` : 'incomplete'}
          </span>
          <button className="btn small" onClick={() => { store.saveToLibrary(); say('Saved to My budgets'); }}>{store.isSaved ? 'Save' : 'Save'}</button>
        </div>
      </header>
      <nav className="tabs no-print" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} data-testid={`tab-${k}`}>{label}</button>
        ))}
      </nav>
      {flash ? <div className="flash no-print">{flash}</div> : null}
      <main>
        {tab === 'wizard' && <Wizard budget={budget} result={result} update={update} onExport={doExport} />}
        {tab === 'table' && <TableTab ctx={ctx} />}
        {tab === 'calculators' && <Calculators />}
        {tab === 'report' && <ReportTab ctx={ctx} />}
        {tab === 'library' && <LibraryTab ctx={ctx} />}
        {tab === 'guide' && <GuideTab />}
      </main>
      <footer className="no-print">
        Runs entirely in your browser; budgets are stored locally on this device. Verify inputs and models – the laboratory remains responsible for its uncertainty evaluation (ISO/IEC 17025 7.6).
      </footer>
    </div>
  );
}

function TableTab({ ctx }: { ctx: Ctx }) {
  const { budget, result, update, doExport, setTab } = ctx;
  const [sel, setSel] = useState<string | null>(null);
  const comp = budget.components.find((c) => c.id === sel);
  return (
    <div className="stack">
      <ResultsPanel budget={budget} result={result} />
      <div className="card">
        <h3>Uncertainty budget</h3>
        <p className="muted small">Click a row to edit that component.</p>
        <BudgetTable budget={budget} result={result} onSelect={setSel} />
      </div>
      {comp ? (
        <ComponentEditor
          budget={budget}
          component={comp}
          result={result.components[budget.components.indexOf(comp)]}
          onChange={(nc) => update((b) => ({ ...b, components: b.components.map((c) => (c.id === nc.id ? nc : c)) }))}
          onRemove={() => { update((b) => ({ ...b, components: b.components.filter((c) => c.id !== comp.id) })); setSel(null); }}
        />
      ) : null}
      <div className="card">
        <h3>Coverage and rounding</h3>
        <CoverageSettings budget={budget} update={update} />
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => doExport('csv')}>Download CSV</button>
        <button className="btn" onClick={() => doExport('json')}>Download JSON</button>
        <button className="btn primary" onClick={() => setTab('report')}>Printable report</button>
      </div>
    </div>
  );
}

function ReportTab({ ctx }: { ctx: Ctx }) {
  const { budget, result, doExport } = ctx;
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => budgetToHTML(budget, result), [budget, result]);
  return (
    <div className="stack">
      <div className="btn-row no-print">
        <button className="btn primary" onClick={() => frame.current?.contentWindow?.print()}>Print / Save as PDF</button>
        <button className="btn" onClick={() => downloadFile(`${safeFileName(budget.title)}_report.html`, html, 'text/html;charset=utf-8')}>Download HTML report</button>
        <button className="btn" onClick={() => doExport('csv')}>Download CSV</button>
      </div>
      {result.errors.length ? <Explain tone="warn" title="This budget has unresolved errors">The report will show them; fix them in the wizard before using it for accreditation.</Explain> : null}
      <iframe ref={frame} title="Report preview" className="report-frame" srcDoc={html} data-testid="report-frame" />
    </div>
  );
}

function LibraryTab({ ctx }: { ctx: Ctx }) {
  const { budget, result, store, doExport, setTab, say } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const items = Object.values(store.library).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : [data];
      const loaded = list.map((x) => normalizeBudget(x));
      store.replace(loaded[0]);
      say(`Imported “${loaded[0].title}”`);
      setTab('wizard');
    } catch (e) {
      say(`Import failed: ${(e as Error).message}`);
    }
  };
  return (
    <div className="stack">
      <div className="card">
        <h3>Current budget</h3>
        <p><b>{budget.title}</b> · {budget.components.length} components · U = {fmtNum(result.U, 3)} {budget.measurand.unit}</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => { store.saveToLibrary(); say('Saved'); }}>Save to this browser</button>
          <button className="btn" onClick={() => { const copy = { ...budget, id: uid('b'), title: `${budget.title} (copy)` }; store.replace(copy); say('Duplicated'); }}>Duplicate</button>
          <button className="btn" onClick={() => doExport('json')}>Export JSON file</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON file</button>
          <button className="btn" onClick={() => { store.replace(newBudget()); setTab('wizard'); }}>Start a new budget</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </div>
      </div>
      <div className="card">
        <h3>Saved in this browser ({items.length})</h3>
        {items.length === 0 ? <p className="muted">Nothing saved yet. Budgets are kept in this browser's local storage – export JSON files to keep them with your records or move them to another device.</p> : null}
        <ul className="lib-list">
          {items.map((b) => (
            <li key={b.id}>
              <div><b>{b.title}</b><div className="muted small">{b.components.length} components · updated {b.updatedAt.slice(0, 16).replace('T', ' ')} UTC</div></div>
              <span className="actions">
                <button className="btn small" onClick={() => { store.replace(b); setTab('wizard'); }}>Open</button>
                <button className="btn small" onClick={() => downloadFile(`${safeFileName(b.title)}.budget.json`, JSON.stringify(b, null, 2), 'application/json')}>Export</button>
                <button className="btn small danger" onClick={() => { if (confirm(`Delete “${b.title}” from this browser?`)) store.removeFromLibrary(b.id); }}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>Worked examples</h3>
        <p className="muted">Load a published example to see how a complete budget looks (and to check the math against the source).</p>
        <div className="btn-row">
          {EXAMPLES.map((ex) => (
            <button key={ex.key} className="btn" onClick={() => { store.replace(ex.make()); setTab('table'); }} data-testid={`example-${ex.key}`}>{ex.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuideTab() {
  return (
    <div className="stack guide">
      <div className="card">
        <h3>The method in eight steps (GUM 8 / TN 1297)</h3>
        <ol>
          <li><b>Define the measurand</b> and write the model Y = f(X₁…X<sub>N</sub>), including corrections for known effects.</li>
          <li><b>List the inputs and influences</b> – reference standard, unit under test, environment, method, operator.</li>
          <li><b>Evaluate each standard uncertainty u(xᵢ)</b>: Type A from statistics of repeated readings; Type B from certificates, specifications, handbooks and experience, by choosing a distribution and dividing by its divisor.</li>
          <li><b>Find the sensitivity coefficients</b> cᵢ = ∂f/∂xᵢ (from the model or by experiment).</li>
          <li><b>Combine</b>: u<sub>c</sub>² = Σ(cᵢ·u(xᵢ))² + 2ΣΣ cᵢcⱼu(xᵢ)u(xⱼ)r(xᵢ,xⱼ).</li>
          <li><b>Effective degrees of freedom</b> ν<sub>eff</sub> = u<sub>c</sub>⁴ / Σ[(cᵢuᵢ)⁴/νᵢ] (Welch–Satterthwaite).</li>
          <li><b>Expanded uncertainty</b> U = k·u<sub>c</sub>, with k = t<sub>p</sub>(ν<sub>eff</sub>) for the required level of confidence (≈95 % for accredited calibration).</li>
          <li><b>Report</b> y ± U with k and the level of confidence, U to at most two significant digits (GUM 7.2.6, ILAC P14).</li>
        </ol>
      </div>
      <div className="card">
        <h3>Choosing a distribution</h3>
        <div className="dist-guide">
          {DIST_ORDER.map((k) => (
            <div key={k} className="dist">
              <h4>{DISTRIBUTIONS[k].label} <span className="badge">Type {DISTRIBUTIONS[k].type}</span> <span className="badge alt">÷ {DISTRIBUTIONS[k].divisor}</span></h4>
              <p>{DISTRIBUTIONS[k].whenToUse}</p>
              <p className="muted small">e.g. {DISTRIBUTIONS[k].examples} — {DISTRIBUTIONS[k].reference}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>What assessors look for (ISO/IEC 17025 7.6, ILAC P14)</h3>
        <ul>
          <li>Every significant contribution identified, including the unit under test (resolution, repeatability).</li>
          <li>Each input traceable to its source: certificate number, specification, data record.</li>
          <li>Correct divisors: certificate U divided by its stated k (not assumed 2), rectangular limits by √3.</li>
          <li>Degrees of freedom and coverage factor justified, especially when Type A data are few.</li>
          <li>Expanded uncertainty stated with k and coverage probability, rounded to two significant digits.</li>
          <li>Reported CMC / uncertainty not smaller than the evaluated budget.</li>
        </ul>
      </div>
      <div className="card">
        <h3>Method statement used in reports</h3>
        <p>{METHOD_STATEMENT}</p>
        <h3>References</h3>
        <ol>{REFERENCES.map((r) => <li key={r}>{r}</li>)}</ol>
      </div>
    </div>
  );
}
