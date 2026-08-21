import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

const CLOSED_HEIGHT = "2.5rem";

export function BottomDrawer({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/98 backdrop-blur transition-transform duration-300 ease-out"
      style={{
        maxHeight: "60vh",
        transform: open ? "translateY(0)" : `translateY(calc(100% - ${CLOSED_HEIGHT}))`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-center gap-2 border-b border-slate-800 py-2 text-sm text-slate-300 hover:bg-slate-900"
        style={{ height: CLOSED_HEIGHT }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        Политика и графики
      </button>
      <div
        className="overflow-y-auto p-4"
        style={{ maxHeight: `calc(60vh - ${CLOSED_HEIGHT})` }}
      >
        {children}
      </div>
    </div>
  );
}
