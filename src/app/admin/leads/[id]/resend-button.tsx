"use client";

import { useActionState } from "react";
import { resendMetaEvent, type ActionResult } from "../../actions";

/** Rejoue l'événement de conversion — même `event_id`, donc sans doublon. */
export function ResendButton({ leadId, sent }: { leadId: string; sent: boolean }) {
  const [state, action, pending] = useActionState(resendMetaEvent, null as ActionResult | null);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-md border border-[var(--border-input)] px-4 text-sm disabled:opacity-60"
      >
        {pending ? "Envoi…" : sent ? "Renvoyer l'événement" : "Envoyer l'événement maintenant"}
      </button>
      {state && (
        <p
          role="status"
          className={`mt-3 text-sm ${state.ok ? "text-[var(--ok)]" : "text-[var(--warn-text)]"}`}
        >
          {state.ok ? "✓ " : "✗ "}
          {state.detail}
        </p>
      )}
    </form>
  );
}
