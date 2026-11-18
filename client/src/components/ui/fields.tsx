import { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="label">{label}</p>
      {children}
      {hint && <p className="text-xs text-fg/50">{hint}</p>}
    </div>
  );
}

export function ChoiceChips<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={`chip ${value === o.v ? 'chip-on' : ''}`}>{o.l}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 w-full glass px-3 py-2.5 text-sm text-left">
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${checked ? 'bg-brand' : 'bg-fg/20'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Counter({ value, onChange, label, min = 0, max = 10 }: { value: number; onChange: (n: number) => void; label: string; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button aria-label={`Decrease ${label}`} className="btn-ghost !p-2" onClick={() => onChange(Math.max(min, value - 1))}><Minus size={14} /></button>
      <span className="w-6 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
      <button aria-label={`Increase ${label}`} className="btn-ghost !p-2" onClick={() => onChange(Math.min(max, value + 1))}><Plus size={14} /></button>
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, label, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; label: string; unit?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" className="input !w-24" aria-label={label} value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || min)))} />
      {unit && <span className="text-sm text-fg/60">{unit}</span>}
    </div>
  );
}
