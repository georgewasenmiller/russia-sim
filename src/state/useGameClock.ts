import { useEffect, useRef } from "react";
import { type GameSpeedLevel, msPerDayForSpeed } from "../engine/time";

/** Кламп на дельту реального времени между кадрами — не даёт фоновой/
 * приторможенной вкладке "накопить" аккумулятор при возврате в фокус. */
const MAX_FRAME_DELTA_MS = 250;
/** Не диспатчим чаще ~10 раз/сек независимо от скорости — иначе React
 * (особенно SVG-карта с 83 path) заваливается перерисовками. */
const MIN_DISPATCH_INTERVAL_MS = 100;

type ClockAction =
  | { type: "ADVANCE_TIME"; days: number }
  | { type: "SET_PAUSED"; paused: boolean };

/**
 * rAF-цикл игровых часов — держит аккумулятор дробных игровых суток в
 * рефах (не в React state, чтобы не ре-рендериться сам по себе), и шлёт
 * диспатч ТОЛЬКО когда накопилось целое число суток и прошёл минимальный
 * реальный интервал — см. план "Непрерывный игровой календарь...".
 *
 * Накопление ПОЛНОСТЬЮ останавливается (не просто откладывает диспатч),
 * пока `isPaused`, вкладка скрыта, или `eventActive` — держать модалку
 * события открытой сколько угодно реального времени на любой скорости не
 * приводит к скачку в накопленные дни после её закрытия.
 */
export function useGameClock(
  isPaused: boolean,
  speedLevel: GameSpeedLevel,
  eventActive: boolean,
  dispatch: (action: ClockAction) => void,
): void {
  const isPausedRef = useRef(isPaused);
  const speedLevelRef = useRef(speedLevel);
  const eventActiveRef = useRef(eventActive);
  const dispatchRef = useRef(dispatch);
  isPausedRef.current = isPaused;
  speedLevelRef.current = speedLevel;
  eventActiveRef.current = eventActive;
  dispatchRef.current = dispatch;

  // Основной rAF-цикл — запускается один раз, читает текущие значения из
  // рефов на каждом кадре (не пересоздаётся при смене скорости/паузы —
  // иначе смена скорости сбивала бы плавность цикла).
  useEffect(() => {
    let rafId: number;
    let lastFrameRealMs = performance.now();
    let accumulatedGameDays = 0;
    let lastDispatchRealMs = performance.now();

    function frame(now: number) {
      const rawDelta = now - lastFrameRealMs;
      lastFrameRealMs = now; // обновляется ВСЕГДА, даже при заморозке ниже
      const delta = Math.min(rawDelta, MAX_FRAME_DELTA_MS);

      const frozen = isPausedRef.current || eventActiveRef.current;
      if (!frozen) {
        const msPerDay = msPerDayForSpeed(speedLevelRef.current);
        accumulatedGameDays += delta / msPerDay;
      }

      if (
        accumulatedGameDays >= 1 &&
        now - lastDispatchRealMs >= MIN_DISPATCH_INTERVAL_MS
      ) {
        const days = Math.floor(accumulatedGameDays);
        accumulatedGameDays -= days;
        lastDispatchRealMs = now;
        dispatchRef.current({ type: "ADVANCE_TIME", days });
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Скрытие вкладки — явно ставим паузу (а не молча полагаемся на кламп
  // реального времени выше), чтобы игрок увидел "⏸ пауза" при возврате, а
  // не удивился, что часы почти не сдвинулись за отсутствие. Возврат
  // видимости НЕ снимает паузу автоматически — игрок сам решает, когда
  // продолжить, это безопаснее любого "восстановления" прежней скорости.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        dispatchRef.current({ type: "SET_PAUSED", paused: true });
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
