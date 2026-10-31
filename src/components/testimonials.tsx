"use client";

import { useEffect, useState } from "react";
import type { Testimonial } from "@/content/types";
import { VideoPlayer } from "@/components/video";

/**
 * Les témoignages clients — une carte par personne, la vidéo en calque.
 *
 * La carte montre la tête du client (`poster`) avec l'accroche en
 * surimpression, le résultat en gras : c'est ce qui se lit en défilant, avant
 * d'avoir cliqué. Le lecteur n'est monté qu'à l'ouverture du calque : quatorze
 * lecteurs chargés d'avance pèseraient sur la page sans qu'aucun ne joue.
 */

/** Rend `**gras**` en `<strong>`, sans HTML dans le contenu. */
function Emphasis({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold text-[var(--accent)]">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [open, setOpen] = useState<number | null>(null);

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
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2">
        {items.map((item, i) => {
          const playable = Boolean(item.video);
          return (
            <li key={`${item.name}-${item.business}`}>
              <button
                type="button"
                disabled={!playable}
                onClick={() => playable && setOpen(i)}
                aria-label={playable ? `Lire le témoignage de ${item.name}` : item.name}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--inverse)] text-left shadow-[var(--shadow-soft)] transition-transform enabled:hover:-translate-y-1 enabled:hover:border-[var(--accent)] disabled:cursor-default"
              >
                {item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,var(--inverse-soft),var(--inverse))]"
                  />
                )}
                {/* Le dégradé assombrit le bas : l'accroche se lit sur n'importe quel visage. */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,color-mix(in_srgb,var(--inverse)_55%,transparent)_65%,var(--inverse)_100%)]"
                />

                {playable && (
                  <span
                    aria-hidden
                    className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-strong)] transition-transform group-hover:scale-105"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}

                <span className="absolute inset-x-0 bottom-0 p-5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-on-inverse)] opacity-80">
                    {item.name} · {item.business}
                  </span>
                  <span className="mt-2 block font-display text-[clamp(17px,1.7vw,21px)] leading-[1.2] text-[var(--text-on-inverse)]">
                    <Emphasis text={item.headline} />
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
          aria-label={`Témoignage de ${current.name}`}
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
            <p className="eyebrow mb-2 text-[var(--text-on-inverse)]">
              {current.name} · {current.business}
            </p>
            <h3 className="mb-4 font-display text-[clamp(18px,2.4vw,28px)] leading-[1.15] text-[var(--text-on-inverse)]">
              <Emphasis text={current.headline} />
            </h3>
            <VideoPlayer source={current.video} />
          </div>
        </div>
      )}
    </>
  );
}
