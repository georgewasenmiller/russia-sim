import {
  Activity,
  Frown,
  Gauge,
  Handshake,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { useGame } from "../../state/GameContext";
import { fmtPct, fmtSignedPct, metricColor } from "../../utils/format";

export function KpiCards() {
  const { state } = useGame();

  const cards = [
    {
      icon: <TrendingUp size={18} />,
      label: "Рост ВВП (г/г)",
      value: fmtSignedPct(state.gdpGrowthRateAnnual),
      color: metricColor(state.gdpGrowthRateAnnual, { good: 3, warn: 0 }),
    },
    {
      icon: <Activity size={18} />,
      label: "Инфляция (г/г)",
      value: fmtPct(state.inflationRateAnnual),
      color: metricColor(
        state.inflationRateAnnual,
        { good: 8, warn: 15 },
        true,
      ),
    },
    {
      icon: <Users size={18} />,
      label: "Безработица",
      value: fmtPct(state.unemploymentRate),
      color: metricColor(state.unemploymentRate, { good: 7, warn: 10 }, true),
    },
    {
      icon: <Handshake size={18} />,
      label: "Одобрение",
      value: fmtPct(state.approval, 0),
      color: metricColor(state.approval, { good: 55, warn: 35 }),
    },
    {
      icon: <ShieldAlert size={18} />,
      label: "Коррупция",
      value: fmtPct(state.corruption, 0),
      color: metricColor(state.corruption, { good: 35, warn: 60 }, true),
    },
    {
      icon: <Frown size={18} />,
      label: "Недовольство",
      value: fmtPct(state.socialUnrest, 0),
      color: metricColor(state.socialUnrest, { good: 30, warn: 55 }, true),
    },
    {
      icon: <Gauge size={18} />,
      label: "Госдолг",
      value: fmtPct(state.publicDebt, 0),
      color: metricColor(state.publicDebt, { good: 50, warn: 90 }, true),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
        >
          <div className="flex items-center gap-1.5 text-slate-400">
            {c.icon}
            <span className="text-xs">{c.label}</span>
          </div>
          <span className={`text-xl font-semibold ${c.color}`}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}
