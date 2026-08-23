import { Cpu, Droplet, Factory, Hammer, Wheat, type LucideIcon } from "lucide-react";
import type { IndustrySector } from "../engine/types";

/**
 * Один и тот же визуальный язык, что уже используется в остальном
 * приложении (Droplet — нефть в TopBar.tsx, Factory/Hammer — в
 * RegionPanel.tsx) — не вводит новых иконок сверх уже устоявшихся.
 */
export const SECTOR_ICON: Record<IndustrySector, LucideIcon> = {
  oil_gas: Droplet,
  manufacturing: Factory,
  agriculture: Wheat,
  tech: Cpu,
  infrastructure: Hammer,
};
