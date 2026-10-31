"use client";

import { useEffect, useState } from "react";

/**
 * Verrou temporel sous la VSL : le bouton de candidature ne s'ouvre qu'au
 * bout du décompte.
 *
 * Le point de départ est mémorisé dans le navigateur, pas seulement en
 * mémoire. Sans ça, un rechargement relancerait le décompte à zéro et
 * punirait quelqu'un qui a réellement regardé la vidéo. Le déverrouillage est
 * définitif pour un navigateur donné : un visiteur revenu ne repatiente pas.
 * Pour re-tester le décompte : `/?timer=reset`.
 */

const START_KEY = "funnel_lock_start_at";
const UNLOCKED_KEY = "funnel_unlocked";

/** Le stockage jette dans les navigations privées : le verrou ne doit pas en dépendre. */
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Sans mémoire, le décompte repart — jamais bloquant. */
  }
}

function format(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Gate({
  durationSeconds,
  title,
  hint,
  children,
}: {
  durationSeconds: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  // Verrouillé au premier rendu : le serveur ne connaît pas l'avancement de ce
  // visiteur, et révéler puis masquer serait pire que l'inverse.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("timer") === "reset") {
      try {
        window.localStorage.removeItem(UNLOCKED_KEY);
        window.localStorage.removeItem(START_KEY);
      } catch {
        /* stockage indisponible : rien à réinitialiser */
      }
    }

    const unlockedAlready = readStorage(UNLOCKED_KEY) === "1";

    const stored = Number(readStorage(START_KEY));
    const startAt = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    if (!unlockedAlready && startAt !== stored) writeStorage(START_KEY, String(startAt));

    const endAt = startAt + durationSeconds * 1000;

    const tick = () => {
      const left = unlockedAlready ? 0 : Math.ceil((endAt - Date.now()) / 1000);
      if (left <= 0) {
        writeStorage(UNLOCKED_KEY, "1");
        setRemaining(0);
        return true;
      }
      setRemaining(left);
      return false;
    };

    // Le premier relevé passe par l'intervalle, jamais en appel direct : un
    // `setState` synchrone dans un effet enchaîne deux rendus avant la première
    // peinture. À 200 ms, l'attente est invisible et le décompte reste juste,
    // puisqu'il se calcule sur l'horloge et non sur le nombre de tics.
    const interval = setInterval(() => {
      if (tick()) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);
  }, [durationSeconds]);

  if (remaining === 0) return <>{children}</>;

  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--panel)] px-6 py-8 text-center">
      <p className="eyebrow">{title}</p>
      <p
        className="mt-3 font-display text-[clamp(40px,6vw,64px)] leading-none tabular-nums"
        aria-live="off"
      >
        {remaining === null ? "--:--" : format(remaining)}
      </p>
      <p className="mt-4 text-sm text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}
