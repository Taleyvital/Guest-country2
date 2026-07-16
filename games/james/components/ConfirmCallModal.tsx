"use client";

import { useEffect, useState } from "react";
import { JAMES_CALL_WINDOW_MS, callTimeRemainingMs } from "../engine";
import type { JamesCall } from "../types";

/** Modale "James ? Confirmer" — n'existe QUE chez le partenaire ciblé. Le
 *  compte à rebours affiché est purement indicatif : c'est le timestamp
 *  serveur au moment du clic (confirmed_at) qui tranche une course entre
 *  équipes, pas ce minuteur client. */
export function ConfirmCallModal({
  call,
  onConfirm,
}: {
  call: JamesCall;
  onConfirm: () => void;
}) {
  const [remaining, setRemaining] = useState(() => callTimeRemainingMs(call.expires_at));

  useEffect(() => {
    const id = setInterval(() => setRemaining(callTimeRemainingMs(call.expires_at)), 100);
    return () => clearInterval(id);
  }, [call.expires_at]);

  const pct = Math.round((remaining / JAMES_CALL_WINDOW_MS) * 100);
  const expired = remaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-card">
        <p className="text-headline-md">James ?</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-tile">
          <div
            className="h-full bg-accent transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <button
          type="button"
          disabled={expired}
          onClick={onConfirm}
          className="btn-primary w-full rounded-full py-4 text-label-lg disabled:cursor-not-allowed disabled:bg-tile disabled:text-outline disabled:shadow-none"
        >
          {expired ? "Trop tard" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
