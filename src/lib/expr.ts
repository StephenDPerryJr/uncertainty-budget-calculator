/**
 * Small, safe expression parser/evaluator for measurement models
 * (no eval / Function).  Grammar:
 *   expr   := term (('+'|'-') term)*
 *   term   := unary (('*'|'/') unary)*
 *   unary  := ('+'|'-') unary | power
 *   power  := atom ('^' unary)?          (right associative; -x^2 = -(x^2))
 *   atom   := number | ident | ident '(' args ')' | '(' expr ')'
 * Identifiers may contain letters (incl. Greek), digits and '_'.
 */

export type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  abs: Math.abs,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
};
const CONSTS: Record<string, number> = { pi: Math.PI, PI: Math.PI };

export const SUPPORTED_FUNCTIONS = Object.keys(FUNCS);

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

const ID_START = /[A-Za-z_\u0370-\u03FF\u00B5]/;
const ID_PART = /[A-Za-z0-9_\u0370-\u03FF\u00B5]/;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new SyntaxError(`Bad number at position ${i + 1}`);
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (ID_START.test(ch)) {
      let j = i + 1;
      while (j < src.length && ID_PART.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '*' && src[i + 1] === '*') { out.push({ t: 'op', v: '^' }); i += 2; continue; }
    if ('+-*/^(),'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '×' || ch === '·') { out.push({ t: 'op', v: '*' }); i++; continue; }
    if (ch === '−') { out.push({ t: 'op', v: '-' }); i++; continue; }
    throw new SyntaxError(`Unexpected character '${ch}' at position ${i + 1}`);
  }
  return out;
}

export function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new SyntaxError(`Expected '${v}'`);
    p++;
  };
  function expr(): Node {
    let n = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v as '+' | '-';
      n = { k: 'bin', op, a: n, b: term() };
    }
    return n;
  }
  function term(): Node {
    let n = unary();
    while (isOp('*') || isOp('/')) {
      const op = (toks[p++] as { v: string }).v as '*' | '/';
      n = { k: 'bin', op, a: n, b: unary() };
    }
    return n;
  }
  function unary(): Node {
    if (isOp('-')) { p++; return { k: 'neg', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (isOp('^')) { p++; return { k: 'bin', op: '^', a: base, b: unary() }; }
    return base;
  }
  function atom(): Node {
    const tk = peek();
    if (!tk) throw new SyntaxError('Unexpected end of expression');
    if (tk.t === 'num') { p++; return { k: 'num', v: tk.v }; }
    if (tk.t === 'id') {
      p++;
      if (isOp('(')) {
        p++;
        if (!(tk.v in FUNCS)) throw new SyntaxError(`Unknown function '${tk.v}'`);
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(expr());
          while (isOp(',')) { p++; args.push(expr()); }
        }
        expect(')');
        return { k: 'call', fn: tk.v, args };
      }
      return { k: 'var', name: tk.v };
    }
    if (isOp('(')) { p++; const n = expr(); expect(')'); return n; }
    throw new SyntaxError(`Unexpected '${tk.v}'`);
  }
  if (toks.length === 0) throw new SyntaxError('Empty expression');
  const root = expr();
  if (p < toks.length) throw new SyntaxError(`Unexpected '${(toks[p] as { v: unknown }).v}'`);
  return root;
}

export function evaluate(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var':
      if (n.name in vars) return vars[n.name];
      if (n.name in CONSTS) return CONSTS[n.name];
      throw new ReferenceError(`No value for variable '${n.name}'`);
    case 'neg': return -evaluate(n.a, vars);
    case 'bin': {
      const a = evaluate(n.a, vars);
      const b = evaluate(n.b, vars);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
      }
      break;
    }
    case 'call': return FUNCS[n.fn](...n.args.map((x) => evaluate(x, vars)));
  }
  return NaN;
}

/** Free variable names in an expression (constants like pi excluded unless shadowed). */
export function variablesOf(n: Node, out: Set<string> = new Set()): Set<string> {
  switch (n.k) {
    case 'var': if (!(n.name in CONSTS)) out.add(n.name); break;
    case 'neg': variablesOf(n.a, out); break;
    case 'bin': variablesOf(n.a, out); variablesOf(n.b, out); break;
    case 'call': n.args.forEach((x) => variablesOf(x, out)); break;
  }
  return out;
}

export interface CompiledModel {
  ast: Node;
  variables: string[];
  evaluate: (vars: Record<string, number>) => number;
}

export function compileModel(src: string): CompiledModel {
  const ast = parse(src);
  return { ast, variables: [...variablesOf(ast)], evaluate: (v) => evaluate(ast, v) };
}

/**
 * Sensitivity coefficient c_i = df/dx_i by central finite difference
 * (GUM 5.1.3 allows numerical evaluation).  Step h is chosen relative to the
 * standard uncertainty of x_i when known (so the derivative is taken over the
 * range that matters), else relative to |x_i|.  Richardson extrapolation of two
 * central differences gives O(h^4) truncation error.
 */
export function partialDerivative(
  f: (vars: Record<string, number>) => number,
  vars: Record<string, number>,
  name: string,
  scaleHint?: number,
): number {
  const x = vars[name];
  let h = Math.max(Math.abs(x) * 1e-4, scaleHint && scaleHint > 0 ? scaleHint * 1e-2 : 0);
  if (h === 0) h = 1e-6;
  const at = (dx: number) => f({ ...vars, [name]: x + dx });
  const d1 = (at(h) - at(-h)) / (2 * h);
  const d2 = (at(h / 2) - at(-h / 2)) / h;
  const r = (4 * d2 - d1) / 3;
  return Math.abs(r) < 1e-300 ? 0 : r;
}
