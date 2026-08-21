import { Landmark } from "lucide-react";
import { useGame } from "../state/GameContext";

export function NewGameScreen() {
  const { startGame } = useGame();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-center">
      <Landmark size={48} className="text-violet-400" />
      <div>
        <h1 className="text-3xl font-semibold text-slate-100">
          Россия, 2000 год
        </h1>
        <p className="mt-2 max-w-xl text-slate-400">
          После кризиса 1998 года и смены власти страна выходит из рецессии:
          посткризисный отскок роста ВВП, высокая инфляция, низкие резервы и
          тяжёлый госдолг — но население ждёт стабильности и готово поддержать
          новый курс. Управляйте бюджетом, стройте отрасли, проводите реформы
          и следите за ценой нефти — она определит судьбу бюджета на годы
          вперёд.
        </p>
      </div>
      <button
        type="button"
        onClick={startGame}
        className="rounded-md bg-violet-600 px-6 py-3 font-medium text-white shadow transition hover:bg-violet-500"
      >
        Начать игру
      </button>
    </div>
  );
}
