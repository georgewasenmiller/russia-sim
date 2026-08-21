import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGame } from "../../state/GameContext";
import type { TurnSnapshot } from "../../engine/types";

const AXIS_STYLE = { fontSize: 11, fill: "#8a93a6" };
const GRID_COLOR = "#1e2430";
const TOOLTIP_STYLE = {
  background: "#0f1420",
  border: "1px solid #2a2f3d",
  borderRadius: 6,
  fontSize: 12,
  color: "#e2e5eb",
};

function labelFor(d: TurnSnapshot) {
  return `${d.quarter}кв${String(d.year).slice(2)}`;
}

function Chart({
  title,
  data,
  lines,
}: {
  title: string;
  data: TurnSnapshot[];
  lines: { key: keyof TurnSnapshot; color: string; name: string }[];
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="mb-2 text-sm font-medium text-slate-300">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey={(d: TurnSnapshot) => labelFor(d)}
              tick={AXIS_STYLE}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis tick={AXIS_STYLE} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#8a93a6" }} />
            {lines.map((l) => (
              <Line
                key={String(l.key)}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HistoryCharts() {
  const { state } = useGame();
  const data = state.history;

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">
        Графики появятся после первого хода.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Chart
        title="Рост ВВП и инфляция, %"
        data={data}
        lines={[
          { key: "gdpGrowthRateAnnual", color: "#34d399", name: "Рост ВВП" },
          { key: "inflationRateAnnual", color: "#f87171", name: "Инфляция" },
        ]}
      />
      <Chart
        title="Одобрение и недовольство"
        data={data}
        lines={[
          { key: "approval", color: "#60a5fa", name: "Одобрение" },
          { key: "socialUnrest", color: "#fb923c", name: "Недовольство" },
        ]}
      />
      <Chart
        title="Цена нефти, $/барр."
        data={data}
        lines={[{ key: "oilPrice", color: "#fbbf24", name: "Нефть" }]}
      />
      <Chart
        title="Безработица, %"
        data={data}
        lines={[{ key: "unemploymentRate", color: "#a78bfa", name: "Безработица" }]}
      />
      <Chart
        title="Резервы, $ млрд"
        data={data}
        lines={[{ key: "reserves", color: "#22d3ee", name: "Резервы" }]}
      />
      <Chart
        title="Госдолг, % ВВП"
        data={data}
        lines={[{ key: "publicDebt", color: "#f472b6", name: "Госдолг" }]}
      />
    </div>
  );
}
