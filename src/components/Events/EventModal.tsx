import { AlertTriangle } from "lucide-react";
import { useGame } from "../../state/GameContext";

export function EventModal() {
  const { state, dispatch } = useGame();
  const event = state.activeEvent;
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-lg border border-amber-700/50 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <AlertTriangle size={20} />
          <h2 className="text-lg font-semibold">{event.title}</h2>
        </div>
        <p className="mb-5 text-sm text-slate-300">{event.description}</p>
        <div className="flex flex-col gap-2">
          {event.choices.map((choice) => {
            const disabled = choice.requires ? !choice.requires(state) : false;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  dispatch({ type: "RESOLVE_EVENT_CHOICE", choiceId: choice.id })
                }
                className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-left transition hover:border-violet-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">
                    {choice.label}
                  </span>
                  {choice.pgCost ? (
                    <span className="text-xs text-violet-400">
                      −{choice.pgCost} очк.
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {choice.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
