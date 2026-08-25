import {
  Activity,
  Banknote,
  Frown,
  Handshake,
  ShieldAlert,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { nationalGdpPerCapitaUsd, nationalGdpUsdAnnual } from "../../engine/economyMetrics";
import { useGame } from "../../state/GameContext";
import {
  fmtPct,
  fmtSignedPct,
  fmtUsdAuto,
  fmtUsdPerCapita,
  metricColor,
  metricSeverity,
} from "../../utils/format";

interface Thresholds {
  good: number;
  warn: number;
}

function gauged(
  icon: React.ReactNode,
  label: string,
  value: string,
  raw: number,
  thresholds: Thresholds,
  invert = false,
) {
  return {
    icon,
    label,
    value,
    color: metricColor(raw, thresholds, invert),
    severity: metricSeverity(raw, thresholds, invert),
  };
}

export function KpiCards() {
  const { state } = useGame();

  const cards = [
    {
      icon: <Banknote size={18} />,
      label: "ВВП ($, за год)",
      value: fmtUsdAuto(nationalGdpUsdAnnual(state)),
      color: "text-slate-100",
      severity: "ok" as const,
    },
    {
      icon: <User size={18} />,
      label: "ВВП на душу",
      value: fmtUsdPerCapita(nationalGdpPerCapitaUsd(state)),
      color: "text-slate-100",
      severity: "ok" as const,
    },
    gauged(
      <TrendingUp size={18} />,
      "Рост ВВП (г/г)",
      fmtSignedPct(state.gdpGrowthRateAnnual),
      state.gdpGrowthRateAnnual,
      { good: 3, warn: 0 },
    ),
    gauged(
      <Activity size={18} />,
      "Инфляция (г/г)",
      fmtPct(state.inflationRateAnnual),
      state.inflationRateAnnual,
      { good: 8, warn: 15 },
      true,
    ),
    gauged(
      <Users size={18} />,
      "Безработица",
      fmtPct(state.unemploymentRate),
      state.unemploymentRate,
      { good: 7, warn: 10 },
      true,
    ),
    gauged(
      <Handshake size={18} />,
      "Одобрение",
      fmtPct(state.approval, 0),
      state.approval,
      { good: 55, warn: 35 },
    ),
    gauged(
      <ShieldAlert size={18} />,
      "Коррупция",
      fmtPct(state.corruption, 0),
      state.corruption,
      { good: 35, warn: 60 },
      true,
    ),
    gauged(
      <Frown size={18} />,
      "Недовольство",
      fmtPct(state.socialUnrest, 0),
      state.socialUnrest,
      { good: 30, warn: 55 },
      true,
    ),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`flex flex-col gap-1 rounded-lg border p-3 transition ${
            c.severity === "critical"
              ? "border-rose-700/70 bg-slate-900/60 ring-2 ring-rose-500/60 shadow-[0_0_14px_rgba(244,63,94,0.35)]"
              : "border-slate-800 bg-slate-900/60"
          }`}
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
