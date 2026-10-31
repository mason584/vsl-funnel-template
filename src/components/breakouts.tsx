"use client";

import { useEffect, useState } from "react";
import type { Breakout } from "@/content/types";
import { VideoPlayer } from "@/components/video";

/**
 * Les six vidéos courtes de la page de remerciement — la grille de cartes,
 * et le lecteur en surimpression qui s'ouvre au clic.
 *
 * Une carte sans vidéo reste cliquable à rien : elle garde sa place dans la
 * grille et dit son titre, pour qu'on voie la mise en page avant d'avoir
 * tourné les vidéos. Le lecteur n'est monté qu'à l'ouverture : six lecteurs
 * chargés d'avance pèseraient sur la page sans qu'aucun ne joue.
 */
export function Breakouts({ items }: { items: Breakout[] }) {
  const [open, setOpen] = useState<number | null>(null);

  // Échap ferme ; le défilement de la page s'arrête derrière le calque.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const current = open !== null ? items[open] : null;

  return (
    <>
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const playable = Boolean(item.video);
          return (
            <li key={item.title}>
              <button
                type="button"
                disabled={!playable}
                onClick={() => playable && setOpen(i)}
                aria-label={playable ? `Lire : ${item.title}` : `${item.title} (vidéo à venir)`}
                className="group relative block aspect-video w-full overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--inverse)] text-left shadow-[var(--shadow-soft)] transition-transform enabled:hover:-translate-y-1 enabled:hover:border-[var(--accent)] disabled:cursor-default"
              >
                {item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-80"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,var(--inverse-soft),var(--inverse))]"
                  />
                )}
                {/* Un dégradé pour que le titre se lise sur n'importe quelle vignette. */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,var(--inverse)_100%)] opacity-90"
                />

                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-on-inverse)]">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  Question {i + 1}
                </span>

                {playable ? (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-[42%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-strong)] transition-transform group-hover:scale-105"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                ) : (
                  <span className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded border border-[var(--border-strong)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-on-inverse)] opacity-70">
                    Vidéo à venir
                  </span>
                )}

                <span className="absolute inset-x-0 bottom-0 p-5">
                  <span className="block font-display text-[clamp(16px,1.6vw,20px)] leading-[1.2] text-[var(--text-on-inverse)]">
                    {item.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {current?.video && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--inverse)]/95 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Fermer"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--inverse-soft)] text-[var(--text-on-inverse)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow mb-3 text-[var(--text-on-inverse)]">Question {open! + 1}</p>
            <h3 className="mb-4 font-display text-[clamp(18px,2.4vw,28px)] leading-[1.15] text-[var(--text-on-inverse)]">
              {current.title}
            </h3>
            <VideoPlayer source={current.video} />
          </div>
        </div>
      )}
    </>
  );
}
