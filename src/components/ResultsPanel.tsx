import { reportingStatement } from '../lib/report';
import type { Budget, BudgetResult } from '../lib/types';
import { fmtDof, fmtNum } from '../lib/uncertainty';
import { Explain, NumberField, SelectField } from './inputs';

export function CoverageSettings(props: { budget: Budget; update: (fn: (b: Budget) => Budget) => void }) {
  const { budget: b, update } = props;
  const cov = b.coverage;
  const setCov = (patch: Partial<Budget['coverage']>) => update((x) => ({ ...x, coverage: { ...x.coverage, ...patch } }));
  return (
    <div className="grid4">
      <SelectField<'confidence' | 'fixed-k'>
        label="Coverage factor"
        value={cov.mode}
        options={[{ value: 'confidence', label: 'From Student t at a confidence level (recommended)' }, { value: 'fixed-k', label: 'Fixed k (e.g. k = 2)' }]}
        onChange={(v) => setCov({ mode: v })}
        testId="coverage-mode"
      />
      {cov.mode === 'confidence' ? (
        <>
          <SelectField<string>
            label="Level of confidence p"
            value={String(cov.confidencePercent)}
            options={[
              { value: '95.45', label: '95.45 % (k = 2 for large ν) – default' },
              { value: '95', label: '95 %' },
              { value: '99', label: '99 %' },
              { value: '99.73', label: '99.73 % (k = 3 for large ν)' },
              { value: '90', label: '90 %' },
              { value: '68.27', label: '68.27 % (k = 1)' },
              ...(![95.45, 95, 99, 99.73, 90, 68.27].includes(cov.confidencePercent) ? [{ value: String(cov.confidencePercent), label: `${cov.confidencePercent} %` }] : []),
            ]}
            onChange={(v) => setCov({ confidencePercent: Number(v) })}
          />
          <SelectField<'truncate' | 'interpolate'>
            label="Non-integer νeff"
            value={cov.dofHandling}
            options={[{ value: 'truncate', label: 'Truncate to next lower integer (GUM G.6.4)' }, { value: 'interpolate', label: 'Use exact (fractional) ν' }]}
            onChange={(v) => setCov({ dofHandling: v })}
          />
        </>
      ) : (
        <NumberField label="k" value={cov.k} onChange={(v) => setCov({ k: v ?? 2 })} />
      )}
      <SelectField<'nearest' | 'up'>
        label="Rounding of U (2 significant digits)"
        value={b.rounding}
        options={[{ value: 'nearest', label: 'Round to nearest' }, { value: 'up', label: 'Round up (conservative, GUM 7.2.6)' }]}
        onChange={(v) => update((x) => ({ ...x, rounding: v }))}
      />
    </div>
  );
}

export function ResultsPanel(props: { budget: Budget; result: BudgetResult }) {
  const { budget: b, result: r } = props;
  const unit = b.measurand.unit;
  return (
    <div className="results" data-testid="results">
      <div className="result-cards">
        <div className="rc"><span>Estimate y</span><b>{fmtNum(r.y, 10)}</b><small>{unit}</small></div>
        <div className="rc"><span>Combined std. uncertainty u<sub>c</sub></span><b data-testid="uc">{fmtNum(r.uc, 4)}</b><small>{unit}</small></div>
        <div className="rc"><span>Effective DOF ν<sub>eff</sub></span><b data-testid="veff">{fmtDof(r.veff)}</b><small>{b.coverage.mode === 'confidence' ? `ν used: ${fmtDof(r.dofUsed)}` : 'Welch–Satterthwaite'}</small></div>
        <div className="rc"><span>Coverage factor k</span><b data-testid="k">{r.k.toFixed(3)}</b><small>{b.coverage.mode === 'confidence' ? `t at p = ${b.coverage.confidencePercent} %` : 'fixed'}</small></div>
        <div className="rc main"><span>Expanded uncertainty U</span><b data-testid="U">{fmtNum(r.U, 4)}</b><small>{unit}</small></div>
      </div>
      <div className="statement" data-testid="statement">
        <div className="big">{r.reported ? `${b.measurand.symbol || 'Y'} = (${r.reported.ytext} ± ${r.reported.Utext}) ${unit}` : '—'}</div>
        <p><span className="muted small">Statement for the certificate/report: </span>{reportingStatement(b, r)}</p>
        {r.relativeUc !== null ? <p className="muted small">Relative: u<sub>c</sub>/|y| = {fmtNum(r.relativeUc, 3)} · U/|y| = {fmtNum(r.U / Math.abs(r.y), 3)}</p> : null}
      </div>
      {r.errors.length ? (
        <Explain tone="warn" title="Fix before reporting">
          <ul>{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Explain>
      ) : null}
      {r.warnings.length ? (
        <Explain title="Things an assessor may ask about">
          <ul>{r.warnings.map((e) => <li key={e}>{e}</li>)}</ul>
        </Explain>
      ) : null}
    </div>
  );
}
