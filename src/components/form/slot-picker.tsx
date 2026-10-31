"use client";

import { useEffect, useMemo, useState } from "react";
import type { SlotsResult } from "@/app/(public)/actions";
import { W } from "@/lib/wording";
import styles from "./form.module.css";

/**
 * Le choix du créneau — les jours pourvus, puis les heures du jour choisi.
 *
 * Les heures sont celles qu'iClosed renvoie, dans le fuseau du formulaire :
 * on les affiche telles quelles et on les renvoie telles quelles. C'est le
 * serveur qui reconstruit l'instant avec le bon décalage.
 *
 * Trois états distincts à dessein — chargement, vide, erreur : un chargement
 * infini sur des créneaux vides est le bug le plus coûteux de ce montage,
 * parce que la page a l'air de fonctionner.
 */

function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    .format(date)
    .replace(".", "");
}

export function SlotPicker({
  slots,
  busy,
  done,
  cta,
  error,
  onRetry,
  onBook,
}: {
  slots: SlotsResult | null;
  /** Réservation en cours : les boutons se figent. */
  busy: boolean;
  /** Réservé : on affiche la confirmation le temps de la redirection. */
  done: boolean;
  cta: string;
  error: string | null;
  onRetry: () => void;
  onBook: (date: string, time: string) => void;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const days = useMemo(() => (slots?.state === "ok" ? slots.days : []), [slots]);

  // Le premier jour pourvu est présélectionné dès que les créneaux arrivent ;
  // une relecture (après un créneau pris entre-temps) remet l'heure à zéro.
  useEffect(() => {
    if (days.length === 0) return;
    const timer = window.setTimeout(() => {
      setDay((current) => (current && days.some((d) => d.date === current) ? current : days[0].date));
      setTime(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [days]);

  const times = days.find((d) => d.date === day)?.times ?? [];

  if (done) {
    return (
      <div className={styles.sending} role="status">
        <span className={styles.spinner} aria-hidden />
        {W.booked}
      </div>
    );
  }

  if (slots === null) {
    return (
      <div className={styles.sending} role="status">
        <span className={styles.spinner} aria-hidden />
        {W.slotsLoading}
      </div>
    );
  }

  if (slots.state === "empty") {
    return (
      <p className={styles.notice}>{W.slotsEmpty}</p>
    );
  }

  if (slots.state === "error") {
    return (
      <>
        <p className={styles.notice}>{W.slotsError}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)]"
            onClick={onRetry}
          >
            {W.retry}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.days} role="tablist" aria-label="Jour">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={d.date === day}
            disabled={busy}
            onClick={() => {
              setDay(d.date);
              setTime(null);
            }}
            className={`${styles.day} ${d.date === day ? styles.daySelected : ""}`}
          >
            {formatDay(d.date)}
          </button>
        ))}
      </div>

      <div className={styles.slots} role="radiogroup" aria-label="Heure">
        {times.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={t === time}
            disabled={busy}
            onClick={() => setTime(t)}
            className={`${styles.slot} ${t === time ? styles.slotSelected : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!day || !time || busy}
          onClick={() => day && time && onBook(day, time)}
        >
          {busy ? W.booking : cta}
        </button>
      </div>
    </>
  );
}
