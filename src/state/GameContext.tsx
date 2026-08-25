import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createInitialState } from "../engine/constants";
import { advanceOneDay } from "../engine/turnEngine";
import { resolveEventChoice } from "../engine/events";
import { startBuildingIndustry } from "../engine/industries";
import { changeTaxBurden, type TaxDirection } from "../engine/policy";
import { loadGame, saveGame } from "../engine/save";
import type { GameSpeedLevel } from "../engine/time";
import type { GameState, Sliders } from "../engine/types";
import type { IndustrySector } from "../engine/types";
import { useGameClock } from "./useGameClock";

type Action =
  | { type: "ADVANCE_TIME"; days: number }
  | { type: "SET_SPEED"; level: GameSpeedLevel }
  | { type: "SET_PAUSED"; paused: boolean }
  | { type: "SET_SLIDER"; slider: keyof Sliders; value: number }
  | { type: "CHANGE_TAX_BURDEN"; direction: TaxDirection }
  | { type: "BUILD_INDUSTRY"; sector: IndustrySector; regionId: string }
  | { type: "RESOLVE_EVENT_CHOICE"; choiceId: string }
  | { type: "NEW_GAME" }
  | { type: "LOAD_GAME"; state: GameState };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "ADVANCE_TIME": {
      let next = state;
      for (let i = 0; i < action.days; i++) {
        if (next.gameOver || next.activeEvent) break;
        next = advanceOneDay(next);
      }
      return next;
    }
    case "SET_SPEED":
      return { ...state, gameSpeedLevel: action.level };
    case "SET_PAUSED":
      return { ...state, isPaused: action.paused };
    case "SET_SLIDER":
      return {
        ...state,
        sliders: { ...state.sliders, [action.slider]: action.value },
      };
    case "CHANGE_TAX_BURDEN":
      return changeTaxBurden(state, action.direction);
    case "BUILD_INDUSTRY":
      return startBuildingIndustry(state, action.sector, action.regionId);
    case "RESOLVE_EVENT_CHOICE":
      return resolveEventChoice(state, action.choiceId);
    case "NEW_GAME":
      return createInitialState();
    case "LOAD_GAME":
      return action.state;
    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  resetWarning: boolean;
  dismissResetWarning: () => void;
  started: boolean;
  startGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

/** Не чаще раза в ~2 реальные секунды, плюс гарантированно при паузе и
 * закрытии вкладки — при непрерывном тике состояние меняется до ~10
 * раз/сек (см. useGameClock), сохранять localStorage на каждое изменение
 * было бы заметно дороже, чем раньше (раз на клик). */
const SAVE_THROTTLE_MS = 2000;

export function GameProvider({ children }: { children: ReactNode }) {
  const [resetWarning, setResetWarning] = useState(false);
  const [started, setStarted] = useState(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const { state: loaded, resetWarning: warn } = loadGame();
    if (warn) setResetWarning(true);
    if (loaded) setStarted(true);
    return loaded ?? createInitialState();
  });

  useGameClock(state.isPaused, state.gameSpeedLevel, state.activeEvent !== null, dispatch);

  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSaveRealMs = useRef(0);

  useEffect(() => {
    const elapsed = Date.now() - lastSaveRealMs.current;
    if (elapsed >= SAVE_THROTTLE_MS) {
      lastSaveRealMs.current = Date.now();
      saveGame(state);
      return;
    }
    const timeout = setTimeout(() => {
      lastSaveRealMs.current = Date.now();
      saveGame(stateRef.current);
    }, SAVE_THROTTLE_MS - elapsed);
    return () => clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    if (state.isPaused) saveGame(state);
  }, [state.isPaused]);

  useEffect(() => {
    const handler = () => saveGame(stateRef.current);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      resetWarning,
      dismissResetWarning: () => setResetWarning(false),
      started,
      startGame: () => setStarted(true),
    }),
    [state, resetWarning, started],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
