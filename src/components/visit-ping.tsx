"use client";

import { useEffect, useRef } from "react";
import { metaTouch } from "@/lib/meta-touch";
import { getSessionId, readAttribution } from "@/lib/session";

/**
 * Compte une visite dès l'arrivée sur une page publique.
 *
 * C'est la première marche de l'entonnoir : sans elle, impossible de dire
 * combien de personnes voient la landing pour un formulaire démarré. Un
 * chargement de page compte pour une visite — pas de cookie, pas de
 * dédoublonnage entre sessions, la mesure reste volontairement simple et
 * lisible.
 *
 * C'est aussi ici qu'une arrivée Meta est mémorisée (`metaTouch()` écrit le
 * marqueur) : un visiteur qui revient plus tard par un autre canal garde son
 * premier clic Meta.
 *
 * `sendBeacon` plutôt que `fetch` : la requête survit à une navigation
 * immédiate, et n'entre jamais en concurrence avec le rendu.
 */
export function VisitPing({ path }: { path: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    metaTouch();

    const { landingUrl, utm } = readAttribution();
    const body = JSON.stringify({
      sessionId: getSessionId(),
      path,
      referrer: document.referrer || null,
      landingUrl,
      utm,
    });

    try {
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon("/api/visite", blob)) {
        void fetch("/api/visite", { method: "POST", body, keepalive: true });
      }
    } catch {
      /* le comptage n'est jamais bloquant */
    }
  }, [path]);

  return null;
}
