import { DISTRIBUTIONS, SOURCES } from '../lib/guidance';
import type { Budget, BudgetResult } from '../lib/types';
import { fmtDof, fmtNum } from '../lib/uncertainty';

export function BudgetTable(props: { budget: Budget; result: BudgetResult; onSelect?: (id: string) => void }) {
  const { budget: b, result: r } = props;
  const unit = b.measurand.unit;
  return (
    <div className="table-wrap">
      <table className="budget" data-testid="budget-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Component</th>
            <th>Source</th>
            <th>Type</th>
            <th>Distribution</th>
            <th>Divisor</th>
            <th className="n">u(xᵢ)</th>
            <th className="n">cᵢ</th>
            <th className="n">cᵢ·u(xᵢ) {unit ? `[${unit}]` : ''}</th>
            <th className="n">νᵢ</th>
            <th>% of uc²</th>
          </tr>
        </thead>
        <tbody>
          {b.components.map((c, i) => {
            const cr = r.components[i];
            const bad = cr.errors.length > 0;
            return (
              <tr key={c.id} className={bad ? 'row-bad' : ''} onClick={() => props.onSelect?.(c.id)}>
                <td>{i + 1}</td>
                <td>
                  <b>{c.name}</b>
                  {c.symbol ? <div className="sym">{c.symbol}</div> : null}
                </td>
                <td className="small">{SOURCES[c.source].label}{c.sourceNote ? <div className="muted">{c.sourceNote}</div> : null}</td>
                <td>{cr.type}</td>
                <td>{DISTRIBUTIONS[c.distribution].short}</td>
                <td className="nowrap">{cr.divisorLabel}</td>
                <td className="n">{fmtNum(cr.ui, 4)} <span className="muted">{c.unit}</span></td>
                <td className="n">{fmtNum(cr.ci, 5)}</td>
                <td className="n">{fmtNum(cr.ciui, 4)}</td>
                <td className="n">{fmtDof(cr.dof)}</td>
                <td>
                  <div className="bar"><div style={{ width: `${Math.min(100, cr.percent)}%` }} /></div>
                  <span className="small">{bad ? '—' : `${cr.percent.toFixed(1)} %`}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={8}>Combined standard uncertainty u<sub>c</sub> {r.correlationTerm ? '(incl. correlation)' : '(root-sum-square)'}</td>
            <td className="n"><b>{fmtNum(r.uc, 4)}</b></td>
            <td className="n">ν<sub>eff</sub> {fmtDof(r.veff)}</td>
            <td></td>
          </tr>
          <tr>
            <td colSpan={8}>Expanded uncertainty U = k·u<sub>c</sub>, k = {r.k.toFixed(3)}</td>
            <td className="n"><b>{fmtNum(r.U, 4)}</b></td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
