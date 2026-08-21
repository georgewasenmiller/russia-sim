import { SAVE_KEY, SAVE_VERSION } from "./constants";
import type { GameState } from "./types";

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // localStorage недоступен (приватный режим, квота) — молча пропускаем автосейв
  }
}

export function loadGame(): { state: GameState | null; resetWarning: boolean } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { state: null, resetWarning: false };
  }
  if (!raw) return { state: null, resetWarning: false };

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.saveVersion !== SAVE_VERSION) {
      return { state: null, resetWarning: true };
    }
    return { state: parsed, resetWarning: false };
  } catch {
    return { state: null, resetWarning: true };
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
