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

/**
 * Короткие игровые названия для компактной панели плиток в RegionPanel —
 * намеренно НЕ переиспользуют INDUSTRY_DEFS[sector].label (тот длиннее и
 * используется в тултипах бюджета/карты, где место не так ограничено).
 */
export const BUILDING_FLAVOR_NAME: Record<IndustrySector, string> = {
  oil_gas: "Нефтекомплекс",
  manufacturing: "Завод",
  agriculture: "Агрокомплекс",
  tech: "IT-хаб",
  infrastructure: "Инфраструктура",
};
