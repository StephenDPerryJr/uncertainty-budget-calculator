import { DISTRIBUTIONS, METHOD_STATEMENT, REFERENCES, SOURCES } from './guidance';
import { erf } from './stats';
import type { Budget, BudgetResult } from './types';
import { fmtDof, fmtNum } from './uncertainty';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function csvCell(v: unknown): string {
  const s = v === Infinity ? 'inf' : String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const num = (x: number) => (x === Infinity ? 'inf' : Number.isFinite(x) ? String(Number(x.toPrecision(10))) : '');

export function coverageText(b: Budget, r: BudgetResult): string {
  if (b.coverage.mode === 'fixed-k') return `coverage factor k = ${fmtNum(r.k, 4)} (fixed)`;
  return `coverage factor k = ${r.k.toFixed(3)} from the t-distribution for ν = ${fmtDof(r.dofUsed)} (νeff = ${fmtDof(r.veff)}), level of confidence approximately ${b.coverage.confidencePercent} %`;
}

export function reportingStatement(b: Budget, r: BudgetResult): string {
  const unit = b.measurand.unit ? ` ${b.measurand.unit}` : '';
  if (!r.reported) return 'Result not available – resolve the errors in the budget.';
  const pNormal = erf(b.coverage.k / Math.SQRT2) * 100;
  const conf = b.coverage.mode === 'fixed-k' ? `which for a normal distribution corresponds to a coverage probability of approximately ${pNormal >= 99.5 ? pNormal.toFixed(1) : pNormal.toFixed(0)} %` : `defining an interval estimated to have a level of confidence of approximately ${b.coverage.confidencePercent} %`;
  return `${b.measurand.symbol || 'Y'} = (${r.reported.ytext} ± ${r.reported.Utext})${unit}. The reported expanded uncertainty U = k·uc is based on a combined standard uncertainty uc = ${r.reported.uctext}${unit} multiplied by a ${coverageText(b, r)}, ${conf}.`;
}

export const CSV_HEADER = ['#', 'Component', 'Symbol', 'Type', 'Source', 'Source details', 'Distribution', 'Input value', 'Input scale', 'Input unit', 'Divisor', 'Divisor value', 'u(xi)', 'ci', 'ci*u(xi)', 'Degrees of freedom', '% contribution'];

export function budgetToCSV(b: Budget, r: BudgetResult): string {
  const rows: unknown[][] = [];
  rows.push(['Uncertainty budget', b.title]);
  rows.push(['Measurand', b.measurand.name, b.measurand.symbol, b.measurand.unit]);
  if (b.model.enabled) rows.push(['Model', `${b.measurand.symbol} = ${b.model.expression}`]);
  rows.push(['Laboratory', b.metadata.laboratory, 'Prepared by', b.metadata.preparedBy, 'Date', b.metadata.date]);
  rows.push([]);
  rows.push(CSV_HEADER);
  b.components.forEach((c, i) => {
    const cr = r.components[i];
    const d = DISTRIBUTIONS[c.distribution];
    const input = c.distribution === 'typeA-readings' ? `n=${cr.typeA?.n ?? 0}; mean=${num(cr.typeA?.mean ?? NaN)}; s=${num(cr.typeA?.stdDev ?? NaN)}` : c.distribution === 'typeA-pooled' ? `s_p=${num(c.pooledSd)}` : num(c.value);
    rows.push([i + 1, c.name, c.symbol, cr.type, SOURCES[c.source].label, [c.sourceNote, c.notes].filter(Boolean).join(' | '), d.short, input, c.scale, c.unit, cr.divisorLabel, num(cr.divisor), num(cr.ui), num(cr.ci), num(cr.ciui), num(cr.dof), num(cr.percent)]);
  });
  rows.push([]);
  rows.push(['Estimate y', num(r.y), b.measurand.unit]);
  rows.push(['Combined standard uncertainty uc', num(r.uc), b.measurand.unit]);
  if (r.correlationTerm) rows.push(['Correlation term in uc^2', num(r.correlationTerm)]);
  rows.push(['Effective degrees of freedom veff', num(r.veff)]);
  rows.push(['Degrees of freedom used for k', num(r.dofUsed)]);
  rows.push(['Coverage probability (%)', b.coverage.mode === 'fixed-k' ? 'fixed k' : b.coverage.confidencePercent]);
  rows.push(['Coverage factor k', num(r.k)]);
  rows.push(['Expanded uncertainty U', num(r.U), b.measurand.unit]);
  if (r.reported) rows.push(['Reported (GUM 7.2.6)', `${r.reported.ytext} ± ${r.reported.Utext}`, b.measurand.unit]);
  rows.push([]);
  rows.push(['Method', METHOD_STATEMENT]);
  REFERENCES.forEach((ref, i) => rows.push([`Reference ${i + 1}`, ref]));
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function budgetToHTML(b: Budget, r: BudgetResult): string {
  const unit = esc(b.measurand.unit);
  const rows = b.components
    .map((c, i) => {
      const cr = r.components[i];
      const d = DISTRIBUTIONS[c.distribution];
      let input: string;
      if (c.distribution === 'typeA-readings') input = `n = ${cr.typeA?.n ?? 0}, x̄ = ${fmtNum(cr.typeA?.mean, 8)}, s = ${fmtNum(cr.typeA?.stdDev, 4)}`;
      else if (c.distribution === 'typeA-pooled') input = `s<sub>p</sub> = ${fmtNum(c.pooledSd)}, m = ${c.nAveraged ?? 1}`;
      else input = `${fmtNum(c.value, 6)}${c.scale === 'percent' ? ' %' : c.scale === 'ppm' ? ' ppm' : ''}${c.valueIsFullWidth ? ' (full width)' : ''}`;
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(c.name)}</strong>${c.symbol ? `<br><span class="sym">${esc(c.symbol)}</span>` : ''}</td>
        <td>${esc(SOURCES[c.source].label)}${c.sourceNote ? `<br><span class="note">${esc(c.sourceNote)}</span>` : ''}${c.notes ? `<br><span class="note"><i>Justification:</i> ${esc(c.notes)}</span>` : ''}</td>
        <td>${cr.type}</td>
        <td>${esc(d.short)}</td>
        <td class="n">${input} ${esc(c.unit)}</td>
        <td class="n">${esc(cr.divisorLabel)}</td>
        <td class="n">${fmtNum(cr.ui, 4)} ${esc(c.unit)}</td>
        <td class="n">${fmtNum(cr.ci, 5)}</td>
        <td class="n">${fmtNum(cr.ciui, 4)}</td>
        <td class="n">${fmtDof(cr.dof)}</td>
        <td class="n">${cr.percent.toFixed(1)} %</td>
      </tr>`;
    })
    .join('');
  const vars = b.model.enabled
    ? `<table class="vars"><thead><tr><th>Variable</th><th>Estimate</th><th>Unit</th><th>Description</th></tr></thead><tbody>${b.model.variables
        .map((v) => `<tr><td>${esc(v.name)}</td><td class="n">${fmtNum(v.value, 10)}</td><td>${esc(v.unit)}</td><td>${esc(v.description)}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  const corr = b.correlations.length
    ? `<h2>Correlations</h2><ul>${b.correlations
        .map((cc) => `<li>r(${esc(b.components.find((c) => c.id === cc.a)?.name)}, ${esc(b.components.find((c) => c.id === cc.b)?.name)}) = ${cc.r}</li>`)
        .join('')}</ul>`
    : '';
  const warn = [...r.errors.map((e) => `<li class="err">${esc(e)}</li>`), ...r.warnings.map((w) => `<li>${esc(w)}</li>`)].join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(b.title)} – Uncertainty budget</title>
<style>
  body{font:12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:24px;}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #999}
  table{border-collapse:collapse;width:100%;margin:6px 0} th,td{border:1px solid #bbb;padding:3px 5px;vertical-align:top;text-align:left}
  th{background:#eef2f7;font-size:11px} td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .meta td{border:none;padding:1px 8px 1px 0} .sym{font-style:italic;color:#333} .note{color:#555;font-size:10.5px}
  .result{border:2px solid #1d4ed8;padding:8px 12px;margin:10px 0;background:#f3f6ff} .big{font-size:16px;font-weight:700}
  .summary td{padding:3px 8px} li.err{color:#b00020} .foot{color:#555;font-size:10.5px;margin-top:16px}
  .sig{margin-top:28px;display:flex;gap:40px} .sig div{border-top:1px solid #333;padding-top:3px;min-width:200px}
  @media print{body{margin:10mm} @page{size:landscape;margin:10mm} tr{page-break-inside:avoid}}
</style></head><body>
<h1>Measurement uncertainty budget – ${esc(b.title)}</h1>
<table class="meta"><tr><td><b>Laboratory:</b> ${esc(b.metadata.laboratory) || '—'}</td><td><b>Prepared by:</b> ${esc(b.metadata.preparedBy) || '—'}</td><td><b>Date:</b> ${esc(b.metadata.date)}</td></tr>
<tr><td><b>Procedure:</b> ${esc(b.metadata.procedure) || '—'}</td><td><b>Equipment:</b> ${esc(b.metadata.equipment) || '—'}</td><td><b>Conditions:</b> ${esc(b.metadata.conditions) || '—'}</td></tr></table>
<h2>Measurand and measurement model</h2>
<p><b>${esc(b.measurand.name) || 'Measurand'}</b> (${esc(b.measurand.symbol)}${unit ? `, ${unit}` : ''}). ${esc(b.measurand.description)}</p>
${b.model.enabled ? `<p>Model: <code>${esc(b.measurand.symbol)} = ${esc(b.model.expression)}</code>. Sensitivity coefficients marked “model” are the partial derivatives ∂f/∂x<sub>i</sub> evaluated numerically at the input estimates (GUM 5.1.3).</p>${vars}` : '<p>No explicit model entered; sensitivity coefficients were entered by the user.</p>'}
<h2>Uncertainty budget</h2>
<table><thead><tr><th>#</th><th>Component</th><th>Source of data</th><th>Type</th><th>Distribution</th><th>Input value</th><th>Divisor</th><th>u(x<sub>i</sub>)</th><th>c<sub>i</sub></th><th>c<sub>i</sub>·u(x<sub>i</sub>)<br>[${unit}]</th><th>ν<sub>i</sub></th><th>% contrib.</th></tr></thead>
<tbody>${rows}</tbody></table>
${corr}
<h2>Results</h2>
<table class="summary">
<tr><td>Estimate of the measurand y</td><td class="n">${fmtNum(r.y, 10)} ${unit}</td></tr>
<tr><td>Combined standard uncertainty u<sub>c</sub>(y)</td><td class="n">${fmtNum(r.uc, 5)} ${unit}</td></tr>
${r.relativeUc !== null ? `<tr><td>Relative combined standard uncertainty u<sub>c</sub>/|y|</td><td class="n">${fmtNum(r.relativeUc, 3)}</td></tr>` : ''}
<tr><td>Effective degrees of freedom ν<sub>eff</sub> (Welch–Satterthwaite)</td><td class="n">${fmtDof(r.veff)}</td></tr>
<tr><td>Coverage</td><td class="n">${b.coverage.mode === 'fixed-k' ? 'fixed k' : `p = ${b.coverage.confidencePercent} %, ν used = ${fmtDof(r.dofUsed)} (${b.coverage.dofHandling === 'truncate' ? 'truncated, GUM G.6.4' : 'interpolated'})`}</td></tr>
<tr><td>Coverage factor k</td><td class="n">${r.k.toFixed(3)}</td></tr>
<tr><td>Expanded uncertainty U = k·u<sub>c</sub></td><td class="n">${fmtNum(r.U, 5)} ${unit}</td></tr>
</table>
<div class="result"><div class="big">${r.reported ? `${esc(b.measurand.symbol)} = (${r.reported.ytext} ± ${r.reported.Utext}) ${unit}` : '—'}</div>
<div>${esc(reportingStatement(b, r))}</div></div>
${warn ? `<h2>Notes and warnings</h2><ul>${warn}</ul>` : ''}
${b.metadata.notes ? `<h2>Notes</h2><p>${esc(b.metadata.notes)}</p>` : ''}
<h2>Method</h2><p>${esc(METHOD_STATEMENT)} Rounding: ${b.rounding === 'up' ? 'rounded up (conservative)' : 'rounded to nearest'}.</p>
<h2>References</h2><ol>${REFERENCES.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
<div class="sig"><div>Prepared by / date</div><div>Reviewed / approved by / date</div></div>
<p class="foot">Generated by Uncertainty Budget Calculator Made Simple on ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC. The laboratory remains responsible for the validity of the model, inputs and their sources (ISO/IEC 17025 7.6).</p>
</body></html>`;
}
