import { REGIONS } from "../regions/data";
import type { Region, RegionEconomy } from "../regions/types";
import type { GameState, Industry, IndustryDef, IndustrySector } from "./types";

export const SAVE_VERSION = 7;
export const SAVE_KEY = "russia-sim-save-v1";

export const CLAMP = {
  percent: [0, 100] as [number, number],
  unemployment: [2, 40] as [number, number],
  inflation: [-10, 200] as [number, number],
  gdpGrowth: [-25, 25] as [number, number],
  debt: [0, 250] as [number, number],
  oilPrice: [5, 220] as [number, number],
};

export function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

// --- Тюнинг-константы формул ---
export const TUNING = {
  // Нефть: mean-reverting random walk
  oil: {
    reversionSpeed: 0.12,
    noiseStdDev: 3.5,
    initialMeanTarget: 27,
  },
  // Бюджет
  budget: {
    royaltyShare: 0.55, // доля нефтегазовой выручки, идущая в бюджет
    baseHydrocarbonExportVolume: 4.3, // у.е. объёма экспорта до индустриализации
    otherRevenueShareOfGdp: 0.03,
    baselineSocialSpendShareOfGdp: 0.06,
    reserveSaveRatio: 0.35, // доля профицита, уходящая в резервы
    reserveDrawMaxShare: 0.5, // макс. доля резервов, которую можно потратить на покрытие дефицита за ход
  },
  // Инфляция
  inflation: {
    persistence: 0.55,
    monetizationCoefficient: 1.9,
    oilStrengthDisinflation: 0.06,
    unemploymentGapCoefficient: 0.18,
    noiseStdDev: 1.1,
  },
  // Общестрановой тренд производительности — общий фон, декоративно
  // затухающий за игру (постсоветский рывок вначале). Раньше был
  // независимой добавкой к темпу роста; теперь — множитель "насколько
  // продуктивно используются уже построенные мощности" (см.
  // regionEconomy.ts: regionMacroMultiplier), buildings остаются
  // единственным источником самого ВВП.
  growth: {
    initialPotential: 8.5,
    potentialDecayPerTurn: 0.045,
    potentialFloor: 2.2,
  },
  // Безработица: единственное, что здесь ещё используется напрямую —
  // естественный уровень (структурная фрикционная безработица, к которой
  // тяготеет инфляционный разрыв и миграция) — сама безработица региона
  // теперь считается строго от дефицита рабочих мест, см.
  // regionEconomy.ts: targetRegionUnemployment.
  unemployment: {
    naturalRate: 6,
  },
  // Коррупция
  corruption: {
    oilRentDriftCoefficient: 0.01,
    decayToward: 45,
    decayRate: 0.02,
  },
  // Недовольство
  unrest: {
    inflationCoefficient: 0.22,
    unemploymentCoefficient: 0.9,
    corruptionCoefficient: 0.12,
    approvalRelief: 0.08,
    inertia: 0.7,
  },
  // Одобрение
  approval: {
    growthCoefficient: 1.6,
    inflationCoefficient: 0.55,
    unemploymentDeltaCoefficient: 1.8,
    corruptionCoefficient: 0.1,
    unrestCoefficient: 0.25,
    honeymoonDecayPerTurn: 0.15,
    honeymoonBaseline: 55,
    meanReversion: 0.03,
  },
  // Долг/ставка
  debt: {
    baseInterestRate: 7,
    debtRiskCoefficient: 0.055,
    reservesRiskRelief: 0.12,
  },
  // Политические очки
  politicalPoints: {
    base: 3,
    approvalCoefficient: 0.03,
    unrestPenaltyCoefficient: 0.03,
  },
  /**
   * Множитель отдачи построек региона (см. regionEconomy.ts:
   * regionMacroMultiplier) — здания остаются единственным источником
   * выпуска (buildingsOutput), эти коэффициенты лишь модулируют, насколько
   * продуктивно этот выпуск конвертируется в ВВП. Пересчитаны заново под
   * новую роль (доля самого выпуска, а не темпа годового роста, как было
   * раньше в TUNING.regionGrowth) — жёстко ограничены полом/потолком, чтобы
   * даже одновременный удар всех штрафов не мог обнулить/обратить в
   * отрицательное ВВП региона за один ход.
   */
  regionMacro: {
    floor: 0.35,
    ceiling: 1.5,
    taxDragCoefficient: 0.005, // доля выпуска за п.п. налоговой нагрузки выше 25
    inflationDragThreshold: 12,
    inflationDragCoefficient: 0.004, // доля выпуска за п.п. инфляции выше порога
    unrestDragCoefficient: 0.0015, // доля выпуска за п.п. недовольства
    corruptionDragCoefficient: 0.55, // доля выпуска при коррупции региона = 100 (усилено — реальный разброс corruptionIndex по регионам всего 50-72, не 0-100, см. план "ВВП-индекс/коррупция/Реформы")
    oilSensitivityCoefficient: 0.003, // доля выпуска за $ отклонения цены нефти от целевой (только oil/gas регионы)
    agricultureReformDamping: 0.5, // множитель нацреформ для аграрных регионов
    agricultureStabilityFactor: 0.4, // множитель к noiseStdDev для аграрных регионов
    noiseStdDev: 0.013,
    // potentialGrowth()/tradeGrowthBonus()/сумма реформенных модификаторов
    // gdpGrowthRateAnnual откалиброваны для старой модели (доли годового
    // темпа роста, диапазон ±25) — при переиспользовании как долей самого
    // множителя выпуска делятся на эту константу.
    legacyPointsToFractionDivisor: 100,
  },
  // Безработица региона
  regionUnemployment: {
    populationRatioClamp: [0.2, 5] as [number, number],
    // Целевое значение (targetRegionUnemployment) считается строго от
    // дефицита рабочих мест; фактическое движется к цели за 2-3 хода, не
    // телепортируется мгновенно в тот же ход, что здание достроилось.
    adjustmentSpeed: 0.4,
  },
  // Коррупция региона
  regionCorruption: {
    oilRentDriftMultiplier: 3, // усиление рентного дрейфа для oil/gas-специализации
    ambientDriftMultiplier: 0.3, // фоновый дрейф для остальных регионов
    noiseStdDev: 0.4, // независимый локальный дрейф между реформами
  },
  // Торговля излишками сырья между соседними регионами
  trade: {
    perResourceCoefficient: 0.015, // п.п. роста на единицу gdpIndex лучшего соседа-поставщика
    maxTotalBonus: 2.5, // жёсткий потолок суммарного бонуса по всем типам сырья сразу
  },
  // Миграция рабочей силы между соседями
  migration: {
    gapThreshold: 2, // п.п. разницы безработицы, ниже которого перетока нет
    rate: 0.06, // доля превышения порога, перетекающая за один ход
    maxPerNeighborDelta: 0.5, // кламп потока с одним соседом за ход, п.п.
    maxTotalDeltaPerTurn: 1.2, // кламп суммарного эффекта на регион за ход, п.п.
    shortageAbsorptionFactor: 0.5, // приток снижает безработицу реципиента при дефиците кадров
    dilutionFactor: 0.4, // приток слегка повышает безработицу реципиента без дефицита
  },
  // Влияние инфраструктуры региона на стройку (локальный эффект)
  infrastructure: {
    costMultiplierAtZero: 1.4, // множитель к buildCost при infrastructureLevel=0
    costMultiplierAtMax: 0.8, // множитель к buildCost при infrastructureLevel=100
    turnsMultiplierAtZero: 1.3, // множитель к buildTurns при infrastructureLevel=0
    turnsMultiplierAtMax: 0.8, // множитель к buildTurns при infrastructureLevel=100
  },
  // Трудоспособное население — база для расчёта рабочих мест зданий и
  // строгой безработицы (см. regionLaborForce).
  laborForce: {
    shareOfPopulation: 0.55,
  },
  /**
   * Слоты застройки (см. план "Причинность экономики..."): производственные
   * слоты (oil_gas/manufacturing/agriculture/tech) ограничены населением и
   * живой инфраструктурой региона — инфраструктура (сектор infrastructure)
   * НЕ расходует этот пул вообще, у неё отдельный лимит (см.
   * src/engine/industries.ts: hasFreeInfrastructureSlot), чтобы регион не
   * мог необратимо застрять без возможности построить инфраструктуру, если
   * последний общий слот занят не-инфраструктурным зданием.
   */
  buildingSlots: {
    base: 2,
    populationDivisor: 1.5,
    infrastructureDivisor: 25,
    // Сколько производственных слотов ВСЕГДА остаются свободными от
    // унаследованных (легаси) предприятий при старте партии — гарантирует,
    // что игроку есть что строить немедленно в любом регионе (см.
    // createInitialState). Для большинства регионов легаси-заполнение
    // останавливается раньше этого предела, естественным образом достигнув
    // целевой занятости, — это только нижний порог гарантии, не типичный
    // исход.
    legacyReservedFreeSlots: 1,
  },
  // Общестрановой бонус скорости стройки от промышленной базы всей страны
  // (см. план п.4) — не стоимости, только скорости, дополнительно к
  // локальному эффекту инфраструктуры.
  nationalIndustrialBase: {
    saturationCount: 200, // предприятий по стране, после которого бонус выходит на максимум
    multiplierAtZero: 1.15, // страна без единого предприятия строит на 15% дольше
    multiplierAtSaturation: 0.85, // насыщенная промбаза — на 15% быстрее
  },
  // Инфраструктура как строимый объект
  infrastructureBuild: {
    levelGainPerProject: 10, // прирост RegionEconomy.infrastructureLevel за завершённый проект, кламп на 100
  },
  // Нефтегазовая рента — узкое исключение из "ВВП только от зданий" (см.
  // план п.1): небольшой независимый доход региона с oil/gas-специализацией
  // при цене нефти выше опорной, тот же принцип "$40 — порог ренты", что
  // уже применяется в nextRegionCorruption.
  oilGasRent: {
    coefficient: 0.03,
    referencePrice: 40,
  },
  // Цена изменения налоговой ставки в очках власти (см. src/engine/policy.ts)
  taxPolicy: {
    step: 5, // п.п. за один клик
    ppCost: 6, // очков власти за шаг — сопоставимо по цене с реформами (5-9 PP)
    min: 10,
    max: 60,
  },
};

export const TOTAL_POPULATION = REGIONS.reduce((sum, r) => sum + r.population, 0);
export const AVG_REGION_POPULATION = TOTAL_POPULATION / REGIONS.length;

export function aggregateWeightedUnemployment(
  economies: Record<string, RegionEconomy>,
): number {
  const weighted = REGIONS.reduce(
    (sum, r) => sum + economies[r.id].unemploymentRate * r.population,
    0,
  );
  return weighted / TOTAL_POPULATION;
}

export function aggregateWeightedCorruption(
  economies: Record<string, RegionEconomy>,
): number {
  const weighted = REGIONS.reduce(
    (sum, r) => sum + economies[r.id].corruptionIndex * r.population,
    0,
  );
  return weighted / TOTAL_POPULATION;
}

export const INDUSTRY_DEFS: Record<IndustrySector, IndustryDef> = {
  oil_gas: {
    sector: "oil_gas",
    label: "Нефтегазовый комплекс",
    description:
      "Добыча и экспорт углеводородов. Увеличивает объём экспорта — доходы бюджета от цены нефти растут вместе с этим сектором.",
    buildCost: 14,
    buildTurns: 6,
    baseJobsShare: 1.2,
    productivityPerWorker: 0.012,
    maintenanceCost: 0.6,
    exportVolumeContribution: 0.8,
  },
  manufacturing: {
    sector: "manufacturing",
    label: "Обрабатывающая промышленность",
    description: "Заводы и производство. Стабильный вклад в ВВП и занятость.",
    buildCost: 9,
    buildTurns: 5,
    baseJobsShare: 1.45,
    productivityPerWorker: 0.007,
    maintenanceCost: 0.45,
    exportVolumeContribution: 0,
  },
  agriculture: {
    sector: "agriculture",
    label: "Сельское хозяйство",
    description: "АПК: дешевле и быстрее строить, меньше вклад в ВВП.",
    buildCost: 5,
    buildTurns: 3,
    baseJobsShare: 1.35,
    productivityPerWorker: 0.004,
    maintenanceCost: 0.2,
    exportVolumeContribution: 0,
  },
  tech: {
    sector: "tech",
    label: "Технологии и IT",
    description:
      "Долгая и дорогая стройка, но большой вклад в ВВП и наименьшее содержание на единицу выпуска.",
    buildCost: 16,
    buildTurns: 7,
    baseJobsShare: 1.15,
    productivityPerWorker: 0.014,
    maintenanceCost: 0.35,
    exportVolumeContribution: 0,
  },
  infrastructure: {
    sector: "infrastructure",
    label: "Инфраструктура",
    description:
      "Дороги, энергосети, порты. Скромный прямой доход — основная ценность в ускорении и удешевлении остальной стройки региона.",
    buildCost: 11,
    buildTurns: 4,
    baseJobsShare: 1.25,
    productivityPerWorker: 0.005,
    maintenanceCost: 0.3,
    exportVolumeContribution: 0,
  },
};

/** Трудоспособное население региона, тыс. человек. */
export function regionLaborForce(region: Region): number {
  return region.population * 1000 * TUNING.laborForce.shareOfPopulation;
}

/**
 * Максимум производственных слотов региона (все сектора, кроме
 * infrastructure — у неё отдельный лимит, см. industries.ts:
 * hasFreeInfrastructureSlot). Растёт с населением региона (рабочая сила на
 * параллельные проекты) и живым infrastructureLevel (развитая
 * инфраструктура поддерживает больше одновременных строек) — не
 * фиксирован навсегда, инвестиции в инфраструктуру открывают новые слоты.
 */
export function maxProductionSlots(region: Region, economy: RegionEconomy): number {
  return (
    TUNING.buildingSlots.base +
    Math.round(region.population / TUNING.buildingSlots.populationDivisor) +
    Math.round(economy.infrastructureLevel / TUNING.buildingSlots.infrastructureDivisor)
  );
}

/**
 * Рабочие места и вклад в ВВП ОДНОГО предприятия данного сектора именно в
 * этом регионе — не флэт-константа: нормировано на "долю одного
 * производственного слота" региона (laborForce / maxProductionSlots), то
 * есть один и тот же тип здания даёт разное число рабочих мест в Москве и
 * в Ненецком АО, пропорционально тому, сколько трудоспособного населения
 * "закреплено" за одним слотом в этом конкретном регионе. baseJobsShare
 * (0.85-1.1) — во сколько раз здание этого сектора крупнее/мельче среднего
 * слота; намеренно узкий диапазон, чтобы выбор специализации региона (какой
 * сектор доступен для легаси-предприятий) не приводил к сильно разной
 * занятости у похожих по размеру регионов.
 */
export function computeJobsAndOutput(
  sector: IndustrySector,
  region: Region,
  economy: RegionEconomy,
  alreadyCommittedJobs: number,
): { jobs: number; outputContribution: number } {
  const def = INDUSTRY_DEFS[sector];
  const laborForce = regionLaborForce(region);
  const perBuilding = Math.round(
    (laborForce / maxProductionSlots(region, economy)) * def.baseJobsShare,
  );
  // Ни одно здание не может нанять больше, чем реально осталось
  // трудоспособного населения региона — alreadyCommittedJobs суммирует
  // .jobs ВСЕХ его предприятий (включая ещё строящиеся, не только
  // operational), чтобы параллельный старт нескольких строек тоже не мог
  // совместно превысить laborForce.
  const remainingCapacity = Math.max(laborForce - alreadyCommittedJobs, 0);
  const jobs = Math.min(perBuilding, Math.round(remainingCapacity));
  const outputContribution = jobs * def.productivityPerWorker;
  return { jobs, outputContribution };
}

type SpecializationSector = "oil" | "gas" | "coal" | "metals" | "industry" | "ports" | "agriculture" | "finance" | "tech";

const LEGACY_SPECIALIZATION_TO_SECTOR: Record<SpecializationSector, IndustrySector> = {
  oil: "oil_gas",
  gas: "oil_gas",
  coal: "manufacturing",
  metals: "manufacturing",
  industry: "manufacturing",
  ports: "manufacturing",
  agriculture: "agriculture",
  finance: "tech",
  tech: "tech",
};

/** Секторы для унаследованных предприятий региона при старте партии —
 * только производственные (никогда infrastructure, см. TUNING.buildingSlots
 * doc), выведены из специализаций региона, минимум один (manufacturing по
 * умолчанию, если специализации не распознаны). */
function legacySectorsForRegion(region: Region): IndustrySector[] {
  const sectors = region.specializations
    .map((s) => LEGACY_SPECIALIZATION_TO_SECTOR[s as SpecializationSector])
    .filter((s): s is IndustrySector => s !== undefined);
  const unique = Array.from(new Set(sectors));
  return unique.length > 0 ? unique : ["manufacturing"];
}

/**
 * Унаследованные (легаси) предприятия региона при старте партии —
 * советская промышленная база 2000 года. Не обход правила "ВВП только от
 * зданий", а его буквальное соблюдение: стартовый ВВП тоже приходит от
 * зданий, просто игрок их не строил сам. Заполняет производственные слоты
 * до целевой занятости (из сид-безработицы региона), но никогда не трогает
 * последний legacyReservedFreeSlots слот(ов) — игроку с первого хода есть
 * что строить в любом регионе. Поскольку рабочие места на здание не зависят
 * от общего числа слотов (см. computeJobsAndOutput), для большинства
 * регионов цель занятости достигается заметно раньше этого предела,
 * оставляя куда больше свободных слотов, чем гарантированный минимум.
 */
function seedLegacyIndustries(region: Region): Industry[] {
  const seedEconomy: RegionEconomy = {
    gdpIndex: 0,
    unemploymentRate: region.unemploymentRate,
    corruptionIndex: region.corruptionIndex,
    infrastructureLevel: region.infrastructureSeed,
  };
  const laborForce = regionLaborForce(region);
  const targetEmployment = laborForce * (1 - region.unemploymentRate / 100);
  const slotCap = Math.max(
    1,
    maxProductionSlots(region, seedEconomy) - TUNING.buildingSlots.legacyReservedFreeSlots,
  );

  const sectors = legacySectorsForRegion(region);
  const industries: Industry[] = [];
  let cumulativeJobs = 0;
  let i = 0;
  while (industries.length < slotCap) {
    if (cumulativeJobs >= targetEmployment) break;
    const sector = sectors[i % sectors.length];
    const def = INDUSTRY_DEFS[sector];
    // Легаси-заполнение намеренно передаёт 0, а не cumulativeJobs: этот
    // цикл уже останавливается сам по достижении targetEmployment (ниже
    // laborForce) через отдельную "не перескочить через цель" проверку
    // ниже, которая предполагает примерно ПОСТОЯННЫЙ размер шага. Если
    // здесь же ограничивать jobs остатком до laborForce, шаги ближе к
    // laborForce (а не к более низкой targetEmployment) начинают мельчать,
    // проверка перестаёт срабатывать (мелкий шаг никогда не "перелетает"
    // цель), и цикл вместо остановки у targetEmployment докручивает
    // оставшиеся слоты почти до laborForce — искусственно занижая
    // стартовую безработицу региона. Кап по laborForce нужен только для
    // ПОСЛЕДУЮЩИХ построек игрока (см. industries.ts:startBuildingIndustry),
    // не для этого отдельного, уже самоограничивающегося цикла.
    const { jobs, outputContribution } = computeJobsAndOutput(sector, region, seedEconomy, 0);
    const wouldBe = cumulativeJobs + jobs;
    // Здания добавляются целыми штуками — если ОЧЕРЕДНОЕ здание перелетит
    // цель занятости заметно дальше, чем текущий недобор до неё, ближе к
    // цели остановиться ДО него, а не перескочить через неё (иначе
    // безработица уходит в отрицательную и упирается в пол клампа).
    if (industries.length > 0 && Math.abs(wouldBe - targetEmployment) > Math.abs(cumulativeJobs - targetEmployment)) {
      break;
    }
    industries.push({
      id: `legacy-${region.id}-${industries.length}`,
      regionId: region.id,
      sector,
      label: def.label,
      status: "operational",
      startedAtGameDay: 0,
      completesAtGameDay: 0,
      localInfraMultiplier: 1,
      nationalMultiplier: 1,
      jobs,
      outputContribution,
      maintenanceCost: def.maintenanceCost,
      exportVolumeContribution: def.exportVolumeContribution,
      origin: "legacy",
    });
    cumulativeJobs = wouldBe;
    i += 1;
  }
  return industries;
}

/** Легаси-предприятия всех регионов, посчитаны один раз при загрузке
 * модуля — источник и для GDP_INDEX_SCALE (калибровка нацшкалы под новую,
 * буквально от построек идущую сумму), и для createInitialState. */
const SEED_LEGACY_INDUSTRIES: Industry[] = REGIONS.flatMap(seedLegacyIndustries);

/**
 * Масштаб приведения суммы "сырого" выпуска построек (raw regionEconomies
 * gdpIndex, в единицах computeJobsAndOutput) к нацшкале, на которой
 * откалиброван весь бюджетный движок (state.gdpIndex стартует в районе
 * 100, GDP_TO_USD_BN в formulas.ts подобран под эту величину). Считается
 * один раз из стартовых легаси-предприятий — так что национальный ВВП на
 * старте партии всегда ровно ~100 независимо от конкретных значений
 * baseJobsShare/productivityPerWorker, тем же способом, каким раньше
 * калибровался от статичных сид-gdpIndex регионов.
 */
export const GDP_INDEX_SCALE =
  100 / SEED_LEGACY_INDUSTRIES.reduce((sum, i) => sum + i.outputContribution, 0);

export function aggregateGdpIndex(
  economies: Record<string, RegionEconomy>,
): number {
  const raw = REGIONS.reduce(
    (sum, r) => sum + economies[r.id].gdpIndex,
    0,
  );
  return raw * GDP_INDEX_SCALE;
}

function seedRegionEconomy(region: Region, legacyIndustries: Industry[]): RegionEconomy {
  const laborForce = regionLaborForce(region);
  const jobs = legacyIndustries.reduce((sum, i) => sum + i.jobs, 0);
  const buildingsOutput = legacyIndustries.reduce((sum, i) => sum + i.outputContribution, 0);
  const unemploymentRate = clamp(
    ((laborForce - jobs) / laborForce) * 100,
    CLAMP.unemployment,
  );
  return {
    gdpIndex: buildingsOutput,
    unemploymentRate,
    corruptionIndex: region.corruptionIndex,
    infrastructureLevel: region.infrastructureSeed,
  };
}

export function createInitialState(): GameState {
  const legacyByRegion = new Map<string, Industry[]>();
  for (const industry of SEED_LEGACY_INDUSTRIES) {
    const list = legacyByRegion.get(industry.regionId) ?? [];
    list.push(industry);
    legacyByRegion.set(industry.regionId, list);
  }

  const regionEconomies: Record<string, RegionEconomy> = Object.fromEntries(
    REGIONS.map((r) => [r.id, seedRegionEconomy(r, legacyByRegion.get(r.id) ?? [])]),
  );

  return {
    saveVersion: SAVE_VERSION,
    gameTimeDays: 0,
    gameSpeedLevel: 2,
    isPaused: true,
    turn: 1,
    year: 2000,
    quarter: 1,
    gameOver: null,

    gdpIndex: aggregateGdpIndex(regionEconomies),
    gdpGrowthRateAnnual: 10,
    inflationRateAnnual: 20,
    unemploymentRate: aggregateWeightedUnemployment(regionEconomies),
    approval: 68,
    corruption: aggregateWeightedCorruption(regionEconomies),
    socialUnrest: 30,

    budgetBalance: 0.4,
    reserves: 12,
    publicDebt: 90,
    effectiveInterestRate: 11,

    oilPrice: 25,
    oilPriceMeanTarget: TUNING.oil.initialMeanTarget,

    politicalPoints: 5,
    sliders: {
      taxBurden: 35,
      govSpendingShare: 34,
      deficitMonetizationShare: 40,
    },

    industries: [...SEED_LEGACY_INDUSTRIES],
    activeReforms: [],
    appliedReformIds: [],
    sanctions: [],
    regionEconomies,

    activeEvent: null,
    eventCooldowns: {},

    history: [],
    log: ["Начало игры: 2000, I квартал."],
  };
}
