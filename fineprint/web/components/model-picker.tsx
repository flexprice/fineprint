"use client";
// Model dropdown for the playground. Native <select> can't render a logo per option, so this
// is a small custom listbox: the trigger and every row show the provider's real mark
// (ProviderIcon) beside the model name. No rank/price metadata — just the logo and the name.
import { useEffect, useRef, useState } from "react";
import { byId } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

function resolve(id: string) {
  const m = byId(id);
  // Fallback if a playground id isn't on the published board yet: brand from the id's lab prefix.
  return { id, label: m?.label ?? id, brand: m?.brand ?? id.split(/[-/]/)[0] };
}

export function ModelPicker({ ids, value, onChange }: {
  ids: string[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = resolve(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button type="button" onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}
        className="flex items-center gap-2 border border-line bg-surface rounded-lg pl-2.5 pr-2 py-2 text-[13px] font-semibold w-full sm:w-auto sm:min-w-[188px]">
        <ProviderIcon brand={sel.brand} size={16} />
        <span className="truncate flex-1 text-left">{sel.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-faint shrink-0">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" aria-label="Model"
          className="absolute left-0 sm:left-auto sm:right-0 z-30 mt-1.5 w-full min-w-[248px] max-w-[min(100vw-2rem,248px)] max-h-[300px] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
          {ids.map((id) => {
            const m = resolve(id);
            const on = id === value;
            return (
              <li key={id} role="option" aria-selected={on}>
                <button type="button" onClick={() => { onChange(id); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left ${on ? "bg-surface-2 font-semibold" : "hover:bg-surface-2"}`}>
                  <ProviderIcon brand={m.brand} size={17} />
                  <span className="truncate flex-1">{m.label}</span>
                  {on && (
                    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden className="text-accent shrink-0">
                      <path d="M2.5 6.8l2.7 2.7L10.5 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
