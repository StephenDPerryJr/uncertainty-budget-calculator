// Generates sample report HTML/CSV/JSON for the worked examples: npx vite-node scripts/make-samples.ts
import { writeFileSync } from 'node:fs';
import { EXAMPLES } from '../src/lib/examples';
import { budgetToCSV, budgetToHTML } from '../src/lib/report';
import { computeBudget } from '../src/lib/uncertainty';

for (const ex of EXAMPLES) {
  const b = ex.make();
  const r = computeBudget(b);
  writeFileSync(`samples/${ex.key}.report.html`, budgetToHTML(b, r));
  writeFileSync(`samples/${ex.key}.csv`, budgetToCSV(b, r));
  writeFileSync(`samples/${ex.key}.budget.json`, JSON.stringify(b, null, 2));
  console.log(ex.key, 'uc =', r.uc, 'veff =', r.veff, 'k =', r.k, 'U =', r.U, '->', r.reported?.ytext, '±', r.reported?.Utext);
}
