import type { ReactNode } from "react";

/**
 * Единый стилизованный тултип-снизу для всего приложения (карточка долга
 * в TopBar, плитки зданий в RegionPanel) — вместо нативного браузерного
 * `title`, который на тёмной теме выглядит чужеродно. Чисто CSS
 * (group-hover), без JS-позиционирования: обёртка сама фиксированного
 * размера, тултип всегда снизу от неё.
 */
export function HoverTip({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`group relative ${className}`}>
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-xs -translate-x-1/2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs leading-snug text-slate-200 opacity-0 shadow-lg shadow-black/40 transition-opacity duration-100 group-hover:opacity-100"
      >
        {label}
      </div>
    </div>
  );
}
