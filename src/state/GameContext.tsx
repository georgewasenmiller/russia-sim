import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { createInitialState } from "../engine/constants";
import { processTurn } from "../engine/turnEngine";
import { applyReform } from "../engine/reforms";
import { resolveEventChoice } from "../engine/events";
import { startBuildingIndustry } from "../engine/industries";
import { loadGame, saveGame } from "../engine/save";
import type { GameState, Sliders } from "../engine/types";
import type { IndustrySector } from "../engine/types";

type Action =
  | { type: "NEXT_TURN" }
  | { type: "SET_SLIDER"; slider: keyof Sliders; value: number }
  | { type: "BUILD_INDUSTRY"; sector: IndustrySector; regionId: string }
  | { type: "APPLY_REFORM"; reformId: string }
  | { type: "RESOLVE_EVENT_CHOICE"; choiceId: string }
  | { type: "NEW_GAME" }
  | { type: "LOAD_GAME"; state: GameState };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "NEXT_TURN":
      return processTurn(state);
    case "SET_SLIDER":
      return {
        ...state,
        sliders: { ...state.sliders, [action.slider]: action.value },
      };
    case "BUILD_INDUSTRY":
      return startBuildingIndustry(state, action.sector, action.regionId);
    case "APPLY_REFORM":
      return applyReform(state, action.reformId);
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

export function GameProvider({ children }: { children: ReactNode }) {
  const [resetWarning, setResetWarning] = useState(false);
  const [started, setStarted] = useState(false);
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const { state: loaded, resetWarning: warn } = loadGame();
    if (warn) setResetWarning(true);
    if (loaded) setStarted(true);
    return loaded ?? createInitialState();
  });

  useEffect(() => {
    saveGame(state);
  }, [state]);

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
