import { Landmark } from "lucide-react";
import { INDUSTRY_DEFS } from "../../engine/constants";
import { computeBudget } from "../../engine/formulas";
import { DAYS_PER_QUARTER } from "../../engine/time";
import { useGame } from "../../state/GameContext";
import type { IndustrySector } from "../../engine/types";
import { fmtUsdBn } from "../../utils/format";

const SECTOR_ORDER: IndustrySector[] = [
  "oil_gas",
  "manufacturing",
  "agriculture",
  "tech",
  "infrastructure",
];

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "total" | "balance-good" | "balance-bad";
}) {
  const valueClass =
    emphasis === "balance-good"
      ? "text-emerald-400"
      : emphasis === "balance-bad"
        ? "text-rose-400"
        : emphasis === "total"
          ? "text-slate-100"
          : "text-slate-300";
  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 text-sm ${
        emphasis ? "font-semibold" : ""
      }`}
    >
      <span className={emphasis ? "text-slate-200" : "text-slate-400"}>{label}</span>
      <span className={`font-mono ${valueClass}`}>{value}</span>
    </div>
  );
}

export function BudgetPanel({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  // Показываем квартальный run-rate (как раньше) для читаемости — сама
  // экономика внутри тикает суточно (см. src/engine/turnEngine.ts).
  const budget = computeBudget(state, state.oilPrice, DAYS_PER_QUARTER);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Landmark size={18} /> Бюджет (за квартал)
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          ✕
        </button>
      </div>

      <div>
        <h4 className="mb-1 px-2 text-xs uppercase tracking-wide text-slate-500">
          Доходы
        </h4>
        <div className="rounded-md border border-slate-800 bg-slate-800/20">
          {SECTOR_ORDER.map((sector) => (
            <Row
              key={sector}
              label={`Налог: ${INDUSTRY_DEFS[sector].label}`}
              value={fmtUsdBn(budget.sectorTaxRevenue[sector] ?? 0)}
            />
          ))}
          <Row label="Налог: прочие сектора / услуги" value={fmtUsdBn(budget.baseTaxRevenue)} />
          <Row
            label="Экспортная рента: нефть и газ"
            value={fmtUsdBn(budget.hydrocarbonRevenue)}
          />
          <Row label="Прочие доходы (неналоговые)" value={fmtUsdBn(budget.otherRevenue)} />
          <div className="border-t border-slate-700" />
          <Row label="Итого доходы" value={fmtUsdBn(budget.totalRevenue)} emphasis="total" />
        </div>
      </div>

      <div>
        <h4 className="mb-1 px-2 text-xs uppercase tracking-wide text-slate-500">
          Расходы
        </h4>
        <div className="rounded-md border border-slate-800 bg-slate-800/20">
          <Row label="Госрасходы (соцсфера, аппарат)" value={fmtUsdBn(budget.govSpending)} />
          <Row
            label="Содержание предприятий (upkeep)"
            value={fmtUsdBn(budget.industryMaintenance)}
          />
          <Row label="Обслуживание госдолга" value={fmtUsdBn(budget.debtService)} />
          <div className="border-t border-slate-700" />
          <Row
            label="Итого расходы"
            value={fmtUsdBn(budget.totalExpenditure)}
            emphasis="total"
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-700 bg-slate-800/40">
        <Row
          label={budget.balance >= 0 ? "Баланс (профицит)" : "Баланс (дефицит)"}
          value={`${budget.balance >= 0 ? "+" : ""}${fmtUsdBn(budget.balance)}`}
          emphasis={budget.balance >= 0 ? "balance-good" : "balance-bad"}
        />
      </div>
    </div>
  );
}
