import { useEffect, useId, useState, type ReactNode } from 'react';

function toText(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (v === Infinity) return 'inf';
  return String(v);
}

/** Numeric input that tolerates partial typing ("1e-", "-", "0.") and scientific notation. */
export function NumberField(props: {
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  suffix?: string;
  min?: number;
  testId?: string;
}) {
  const id = useId();
  const [text, setText] = useState(toText(props.value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    // sync from outside unless the current text already represents the value
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== props.value && !(parsed !== null && props.value !== null && Math.abs(parsed - props.value) < 1e-300)) setText(toText(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{props.label}</span>
      <span className="field-row">
        <input
          id={id}
          data-testid={props.testId}
          inputMode="decimal"
          className={bad ? 'bad' : ''}
          value={text}
          placeholder={props.placeholder}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const s = t.trim().replace(/,/g, '.');
            if (s === '') {
              setBad(!props.allowEmpty);
              if (props.allowEmpty) props.onChange(null);
              return;
            }
            const v = /^inf(inity)?$/i.test(s) ? Infinity : Number(s);
            if (Number.isFinite(v) || v === Infinity) {
              setBad(false);
              props.onChange(v);
            } else setBad(true);
          }}
        />
        {props.suffix ? <span className="suffix">{props.suffix}</span> : null}
      </span>
      {props.hint ? <span className="hint">{props.hint}</span> : null}
    </label>
  );
}

export function TextField(props: { label: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; multiline?: boolean; rows?: number; mono?: boolean; testId?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{props.label}</span>
      {props.multiline ? (
        <textarea id={id} data-testid={props.testId} className={props.mono ? 'mono' : ''} rows={props.rows ?? 3} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input id={id} data-testid={props.testId} className={props.mono ? 'mono' : ''} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      )}
      {props.hint ? <span className="hint">{props.hint}</span> : null}
    </label>
  );
}

export function SelectField<T extends string>(props: { label: ReactNode; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; hint?: ReactNode; testId?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{props.label}</span>
      <select id={id} data-testid={props.testId} value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {props.hint ? <span className="hint">{props.hint}</span> : null}
    </label>
  );
}

export function Explain(props: { title?: string; children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  return (
    <div className={`explain ${props.tone ?? 'info'}`}>
      {props.title ? <strong>{props.title}</strong> : null}
      <div>{props.children}</div>
    </div>
  );
}

export function Checkbox(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} /> {props.label}
    </label>
  );
}
