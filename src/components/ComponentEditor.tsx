import { DISTRIBUTIONS, DIST_ORDER, SOURCES } from '../lib/guidance';
import type { Budget, Component, ComponentResult, DistributionKind, SourceType } from '../lib/types';
import { dofFromReliability, fmtDof, fmtNum, isTypeA } from '../lib/uncertainty';
import { Checkbox, Explain, NumberField, SelectField, TextField } from './inputs';

export function ComponentEditor(props: {
  budget: Budget;
  component: Component;
  result?: ComponentResult;
  onChange: (c: Component) => void;
  onRemove?: () => void;
}) {
  const { component: c, result: r, budget } = props;
  const set = (patch: Partial<Component>) => props.onChange({ ...c, ...patch });
  const d = DISTRIBUTIONS[c.distribution];
  const src = SOURCES[c.source];
  const typeA = isTypeA(c.distribution);
  const scalable = !typeA && c.distribution !== 'resolution';
  const variables = budget.model.enabled ? budget.model.variables.map((v) => v.name) : [];

  return (
    <div className="card comp-editor" data-testid="component-editor">
      <div className="comp-head">
        <TextField label="Component name" value={c.name} onChange={(v) => set({ name: v })} />
        <TextField label="Symbol (optional)" value={c.symbol} onChange={(v) => set({ symbol: v })} placeholder="u(x)" />
        {props.onRemove ? (
          <button className="btn danger small" onClick={props.onRemove} title="Remove component">Remove</button>
        ) : null}
      </div>

      <div className="grid2">
        <div>
          <SelectField<SourceType>
            label="Where does the data come from?"
            value={c.source}
            options={Object.entries(SOURCES).map(([k, v]) => ({ value: k as SourceType, label: v.label }))}
            onChange={(v) => set({ source: v })}
          />
          <Explain title="Where to find it">{src.where}</Explain>
          <TextField label="Source details (certificate no., spec, record, date)" value={c.sourceNote} onChange={(v) => set({ sourceNote: v })} placeholder="e.g. Cert. #12345 from ABC Labs, 2026-03-01" />
        </div>
        <div>
          <SelectField<DistributionKind>
            label="Distribution / evaluation type"
            value={c.distribution}
            options={DIST_ORDER.map((k) => ({ value: k, label: DISTRIBUTIONS[k].type === 'A' ? DISTRIBUTIONS[k].label : `Type B · ${DISTRIBUTIONS[k].label}` }))}
            onChange={(v) => set({ distribution: v })}
            testId="dist-select"
          />
          <Explain title={`When to use · divisor ${d.divisor}`}>
            <p>{d.whenToUse}</p>
            <p className="muted"><em>Examples:</em> {d.examples}</p>
            <p className="muted"><em>Reference:</em> {d.reference}</p>
          </Explain>
          {src.suggested !== c.distribution ? (
            <p className="muted small">Typical for this source: <button className="link" onClick={() => set({ distribution: src.suggested })}>{DISTRIBUTIONS[src.suggested].short}</button></p>
          ) : null}
        </div>
      </div>

      <h4>Input data</h4>
      <div className="grid3">
        {c.distribution === 'typeA-readings' ? (
          <>
            <div className="span2">
              <TextField label="Repeated readings (paste from a spreadsheet: spaces, commas, new lines)" value={c.readings} onChange={(v) => set({ readings: v })} multiline rows={4} mono testId="readings" />
            </div>
            <NumberField label="Readings averaged in the reported result" value={c.nAveraged} allowEmpty placeholder={`n (= ${r?.typeA?.n ?? 0})`} onChange={(v) => set({ nAveraged: v })} hint="Leave blank to use n (std dev of the mean). Use 1 if a single reading is reported." />
          </>
        ) : c.distribution === 'typeA-pooled' ? (
          <>
            <NumberField label="Pooled standard deviation s_p" value={c.pooledSd} onChange={(v) => set({ pooledSd: v ?? 0 })} suffix={c.unit} />
            <NumberField label="Degrees of freedom of s_p  (Σ(nᵢ−1))" value={c.pooledDof} onChange={(v) => set({ pooledDof: v ?? 0 })} />
            <NumberField label="Readings averaged now (m)" value={c.nAveraged} allowEmpty placeholder="1" onChange={(v) => set({ nAveraged: v })} hint="u = s_p / √m" />
          </>
        ) : (
          <>
            <NumberField label={d.valueLabel} value={c.value} onChange={(v) => set({ value: v ?? 0 })} suffix={c.scale === 'percent' ? '%' : c.scale === 'ppm' ? 'ppm' : c.unit} testId="value" />
            {c.distribution === 'normal-k' ? <NumberField label="Coverage factor k (from the certificate)" value={c.k} onChange={(v) => set({ k: v ?? 2 })} /> : null}
            {c.distribution === 'normal-conf' ? <NumberField label="Confidence level" value={c.confidencePercent} suffix="%" onChange={(v) => set({ confidencePercent: v ?? 95 })} /> : null}
            {c.distribution === 'normal-k' || c.distribution === 'normal-conf' ? (
              <NumberField label="Stated degrees of freedom (blank = ∞)" value={c.certDof} allowEmpty onChange={(v) => set({ certDof: v })} hint="Only if the certificate states νeff." />
            ) : null}
            {['rectangular', 'triangular', 'u-shaped'].includes(c.distribution) ? (
              <Checkbox label="Value is the full width (2a), not the half-width" checked={c.valueIsFullWidth} onChange={(v) => set({ valueIsFullWidth: v })} />
            ) : null}
          </>
        )}
      </div>
      <div className="grid3">
        <TextField label="Unit of this input" value={c.unit} onChange={(v) => set({ unit: v })} placeholder="mm, V, °C …" />
        {scalable ? (
          <SelectField<'absolute' | 'percent' | 'ppm'>
            label="Value expressed as"
            value={c.scale}
            options={[{ value: 'absolute', label: 'Absolute (in the unit)' }, { value: 'percent', label: '% of a value' }, { value: 'ppm', label: 'ppm of a value' }]}
            onChange={(v) => set({ scale: v })}
          />
        ) : null}
        {scalable && c.scale !== 'absolute' ? (
          <NumberField label="…of value (blank = linked variable / measurand)" value={c.scaleReference} allowEmpty onChange={(v) => set({ scaleReference: v })} suffix={c.unit} />
        ) : null}
      </div>

      <h4>Sensitivity coefficient cᵢ</h4>
      <div className="grid3">
        <SelectField<'manual' | 'model'>
          label="How is cᵢ obtained?"
          value={c.sensitivityMode}
          options={[{ value: 'manual', label: 'Enter it (1 if same unit as the result)' }, { value: 'model', label: 'Compute ∂f/∂x from the model' }]}
          onChange={(v) => set({ sensitivityMode: v })}
        />
        {c.sensitivityMode === 'manual' ? (
          <NumberField label="cᵢ" value={c.sensitivity} onChange={(v) => set({ sensitivity: v ?? 0 })} hint="Converts this input into the unit of the result (e.g. 1, −1, L·α)." />
        ) : (
          <SelectField<string>
            label="Model variable this is an uncertainty of"
            value={c.variable}
            options={[{ value: '', label: variables.length ? '— choose —' : 'Define a model in step 1' }, ...variables.map((v) => ({ value: v, label: v }))]}
            onChange={(v) => set({ variable: v })}
          />
        )}
      </div>

      {!typeA ? (
        <>
          <h4>Degrees of freedom (Type B)</h4>
          <div className="grid3">
            <SelectField<'infinite' | 'reliability' | 'explicit'>
              label="Reliability of this estimate"
              value={c.dofMode}
              options={[
                { value: 'infinite', label: 'Limits are reliable (ν = ∞, usual practice)' },
                { value: 'reliability', label: 'Reliable to ±x % (GUM G.4.2)' },
                { value: 'explicit', label: 'Enter ν directly' },
              ]}
              onChange={(v) => set({ dofMode: v })}
            />
            {c.dofMode === 'reliability' ? (
              <NumberField label="Relative uncertainty of u (Δu/u)" value={c.reliabilityPercent} suffix="%" onChange={(v) => set({ reliabilityPercent: v ?? 0 })} hint={`ν = ½·(Δu/u)⁻² = ${fmtDof(dofFromReliability(c.reliabilityPercent))}`} />
            ) : null}
            {c.dofMode === 'explicit' ? <NumberField label="ν" value={c.dof} allowEmpty onChange={(v) => set({ dof: v })} /> : null}
          </div>
        </>
      ) : null}

      {r ? (
        <div className="calc-strip" data-testid="component-result">
          {r.typeA ? (
            <span>n = {r.typeA.n} · x̄ = {fmtNum(r.typeA.mean, 8)} · s = {fmtNum(r.typeA.stdDev, 4)} · s/√n = {fmtNum(r.typeA.stdDevOfMean, 4)}</span>
          ) : null}
          <span>divisor <b>{r.divisorLabel}</b></span>
          <span>u(xᵢ) = <b>{fmtNum(r.ui, 4)}</b> {c.unit}</span>
          <span>cᵢ = <b>{fmtNum(r.ci, 5)}</b></span>
          <span>cᵢ·u(xᵢ) = <b>{fmtNum(r.ciui, 4)}</b> {budget.measurand.unit}</span>
          <span>ν = <b>{fmtDof(r.dof)}</b></span>
          <span>Type {r.type}</span>
          {r.errors.map((e) => (
            <span key={e} className="err">⚠ {e}</span>
          ))}
        </div>
      ) : null}
      <TextField label="Notes / justification (shown to assessors)" value={c.notes} onChange={(v) => set({ notes: v })} multiline rows={2} />
    </div>
  );
}
