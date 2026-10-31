"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Form } from "@/content/types";
import { validateAnswer, type Answer, type Answers } from "@/lib/answers";
import type { ResolvedWordmark } from "@/lib/appearance";
import { metaTouch } from "@/lib/meta-touch";
import { W } from "@/lib/wording";
import { checkPhone, dialFor } from "@/lib/phone";
import { getSessionId, readAttribution, readCookie } from "@/lib/session";
import { bookSlot, loadSlots, saveProgress, type SlotsResult } from "@/app/(public)/actions";
import { Wordmark } from "@/components/ui/primitives";
import { KEYS } from "./choices";
import { QuestionView } from "./question-view";
import { SlotPicker } from "./slot-picker";
import styles from "./form.module.css";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE FORMULAIRE — une question par écran, puis le créneau.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce composant ne connaît aucune question : il déroule `form.questions`. Le
 * contenu décide de tout, le moteur ne décide de rien — c'est ce qui permet
 * de changer les questions sans toucher une ligne de code.
 *
 * Trois choses le rendent rapide à remplir :
 *  · le clavier fait tout (Entrée avance, les lettres choisissent, ↑ recule) ;
 *  · un choix unique avance tout seul, sans clic de validation ;
 *  · chaque écran validé part au serveur, donc un abandon reste mesurable, un
 *    rechargement reprend là où on s'était arrêté, et le lead est dans iClosed
 *    dès qu'il a laissé ses coordonnées.
 */

/** L'écran d'ouverture porte l'index −1 : la première question est 0. */
const INTRO = -1;

const DRAFT_KEY = "funnel_draft";

/**
 * Le brouillon laissé par une session précédente, borné à des valeurs sûres.
 * Un brouillon illisible ou trafiqué ne doit jamais faire tomber le
 * formulaire : dans le doute, on repart de l'écran d'accueil.
 */
function readDraft(questionCount: number): { answers: Answers; index: number } {
  const empty = { answers: {} as Answers, index: INTRO };
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return empty;
    const draft = JSON.parse(raw) as { answers?: Answers; index?: number };
    return {
      answers: draft.answers ?? {},
      index:
        typeof draft.index === "number"
          ? Math.min(Math.max(draft.index, INTRO), questionCount - 1)
          : INTRO,
    };
  } catch {
    return empty;
  }
}

const variants = {
  enter: (direction: number) => ({ opacity: 0, y: direction > 0 ? 44 : -44 }),
  center: { opacity: 1, y: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? -44 : 44,
    transition: { duration: 0.16, ease: "easeIn" as const },
  }),
};

/*
 * Deux régimes, et c'est volontaire. La sortie est un fondu court et
 * mécanique : personne ne regarde une question qu'il vient de valider. L'entrée
 * est un ressort, qui donne la sensation d'un écran qui vient se poser.
 * `AnimatePresence mode="wait"` les enchaîne, donc leurs durées s'ajoutent.
 */
const transition = {
  enter: { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 },
  exit: { duration: 0.16, ease: "easeIn" as const },
};

type Phase = "form" | "slots" | "booking" | "done";

export function ApplicationForm({
  form,
  defaultDialCountry,
  wordmark,
  embedded = false,
}: {
  form: Form;
  defaultDialCountry: string;
  wordmark: ResolvedWordmark;
  /**
   * Sous la vidéo de la landing : pas d'en-tête ni de navigation fixe, pas
   * d'écran d'accueil (le titre de la landing en tient lieu), et le clavier
   * n'est écouté que lorsque le formulaire a le focus — une page qui défile
   * ne doit pas avancer un formulaire qu'on ne regarde pas.
   */
  embedded?: boolean;
}) {
  const router = useRouter();
  const questions = form.questions;
  const container = useRef<HTMLDivElement>(null);

  /**
   * Le brouillon est relu au tout premier rendu, pas dans un effet : ce
   * composant ne s'exécute que dans le navigateur (voir `form-loader.tsx`),
   * donc `sessionStorage` est déjà lisible et il n'y a aucun rendu serveur à
   * contredire. Un rechargement à la question 5 rouvre la question 5.
   */
  const [draft] = useState(() => readDraft(questions.length));

  // Intégré, la première question s'affiche directement : l'écran d'accueil
  // ferait un clic de plus sous une vidéo qu'on vient de regarder.
  const [index, setIndex] = useState(embedded && draft.index === INTRO ? 0 : draft.index);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Answers>(draft.answers);

  /**
   * Miroir des réponses, toujours à jour. `advance` peut être appelée depuis
   * un `setTimeout` (l'avance automatique d'un choix unique) : la fonction
   * capturée date alors du rendu qui a précédé le clic, où la réponse cochée
   * n'existe pas encore. Toute décision passe par ce miroir ; l'état `answers`
   * ne sert qu'à l'affichage et au brouillon.
   */
  const answersRef = useRef(draft.answers);
  const [dialCountry, setDialCountry] = useState(defaultDialCountry);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [phase, setPhase] = useState<Phase>("form");

  const [slots, setSlots] = useState<SlotsResult | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const attribution = useRef({ landingUrl: "", utm: {} as Record<string, string> });
  const leaving = useRef(false);
  /** Le minuteur de l'avance automatique, pour l'annuler s'il devient caduc. */
  const autoAdvance = useRef<number | undefined>(undefined);

  /* ── Reprise après rechargement ──────────────────────────────────────── */

  useEffect(() => {
    attribution.current = readAttribution();
  }, []);

  useEffect(() => {
    if (index === INTRO && Object.keys(answers).length === 0) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, index }));
    } catch {
      /* stockage indisponible : le serveur garde déjà l'avancement */
    }
  }, [answers, index]);

  /* ── Enregistrement ──────────────────────────────────────────────────── */

  const payload = useCallback(
    (nextAnswers: Answers, step: string) => ({
      sessionId: getSessionId(),
      answers: nextAnswers,
      stepReached: step,
      landingUrl: attribution.current.landingUrl,
      utm: attribution.current.utm,
      fbc: readCookie("_fbc"),
      fbp: readCookie("_fbp"),
      metaTouch: metaTouch(),
    }),
    []
  );

  const leave = useCallback(
    (path: "/merci" | "/suite") => {
      leaving.current = true;
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* rien à nettoyer */
      }
      router.push(`${path}?sid=${encodeURIComponent(getSessionId())}`);
    },
    [router]
  );

  /* ── Créneaux ────────────────────────────────────────────────────────── */

  const fetchSlots = useCallback(() => {
    setSlots(null);
    void loadSlots(getSessionId()).then(setSlots);
  }, []);

  useEffect(() => {
    if (phase !== "slots" || slots !== null) return;
    let cancelled = false;
    void loadSlots(getSessionId()).then((result) => {
      if (!cancelled) setSlots(result);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, slots]);

  const book = useCallback(
    async (date: string, time: string) => {
      if (phase !== "slots") return;
      setPhase("booking");
      setBookingError(null);

      const result = await bookSlot({
        sessionId: getSessionId(),
        slotDate: date,
        slotTime: time,
        fbc: readCookie("_fbc"),
        fbp: readCookie("_fbp"),
        metaTouch: metaTouch(),
      });

      if (result.state === "booked" || result.state === "already") {
        setPhase("done");
        leave("/merci");
        return;
      }

      // Le verrou se relâche pour permettre un nouvel essai — sur un créneau
      // pris entre-temps, par exemple. Les créneaux sont relus.
      setPhase("slots");
      setBookingError(result.message);
      fetchSlots();
    },
    [phase, leave, fetchSlots]
  );

  /* ── Navigation ──────────────────────────────────────────────────────── */

  const current = index >= 0 ? questions[index] : null;

  const validate = useCallback((): string | null => {
    if (!current) return null;

    // Le téléphone se juge contre le pays choisi dans le menu — seul cet
    // écran connaît ce pays, d'où la vérification ici plutôt que dans
    // `validateAnswer`.
    const value = answersRef.current[current.id];

    if (current.kind === "phone") {
      const raw = typeof value === "string" ? value : "";
      if (!raw.trim()) return W.phoneNeeded;
      const check = checkPhone(raw, dialCountry);
      return check.ok ? null : check.hint;
    }

    return validateAnswer(current, value);
  }, [current, dialCountry]);

  const advance = useCallback(async () => {
    if (phase !== "form" || leaving.current) return;

    // L'intro n'a rien à valider ni à enregistrer.
    if (index === INTRO) {
      setDirection(1);
      setIndex(0);
      return;
    }
    if (!current) return;

    const problem = validate();
    if (problem) {
      setError(problem);
      setShake((s) => s + 1);
      return;
    }
    setError(null);

    // Le numéro part au serveur complété de son indicatif : sans lui, un
    // « 6 12 34 56 78 » est inutilisable pour rappeler quelqu'un — et iClosed
    // le refuse.
    const outgoing: Answers = { ...answersRef.current };
    if (current.kind === "phone") {
      const raw = (outgoing[current.id] as string) ?? "";
      outgoing[current.id] =
        raw.trim().startsWith("+") || raw.trim().startsWith("00")
          ? raw.trim()
          : `${dialFor(dialCountry)} ${raw.trim()}`;
      answersRef.current = outgoing;
      setAnswers(outgoing);
    }

    const last = index === questions.length - 1;

    if (last) {
      // La dernière réponse est enregistrée AVANT d'afficher les créneaux : le
      // serveur relit le verdict depuis la base pour accepter de les montrer.
      setPhase("booking");
      const result = await saveProgress(payload(outgoing, current.id));
      if (result.exit) {
        leave("/suite");
        return;
      }
      void saveProgress(payload(outgoing, "slots"));
      setPhase("slots");
      return;
    }

    // L'enregistrement part sans qu'on l'attende : l'écran suivant s'affiche
    // tout de suite, et une latence réseau ne se paie pas en fluidité.
    void saveProgress(payload(outgoing, current.id)).then((result) => {
      // Réponse éliminatoire : inutile de faire écrire un paragraphe à
      // quelqu'un à qui on ne proposera pas de créneau.
      if (result.exit) leave("/suite");
    });

    setDirection(1);
    setIndex((i) => i + 1);
  }, [phase, index, current, validate, dialCountry, questions.length, payload, leave]);

  const back = useCallback(() => {
    if (index <= INTRO || phase !== "form") return;
    // Revenir en arrière pendant qu'une avance automatique est armée ferait
    // repartir en avant une demi-seconde plus tard.
    window.clearTimeout(autoAdvance.current);
    setError(null);
    setDirection(-1);
    setIndex((i) => i - 1);
  }, [index, phase]);

  useEffect(() => () => window.clearTimeout(autoAdvance.current), []);

  /* ── Clavier ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== "form") return;
      if (embedded && !container.current?.contains(document.activeElement)) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (event.key === "Enter" && !typing) {
        event.preventDefault();
        void advance();
        return;
      }

      if (event.key === "ArrowUp" && !typing) {
        event.preventDefault();
        back();
        return;
      }

      // Les lettres choisissent une option — mais jamais pendant qu'on écrit
      // dans un champ de précision.
      if (!typing && current && (current.kind === "single" || current.kind === "multi")) {
        const position = KEYS.indexOf(event.key.toUpperCase());
        const option = current.options?.[position];
        if (position >= 0 && option) {
          event.preventDefault();
          const button = document.querySelectorAll<HTMLButtonElement>(
            `[data-choices] button[role="radio"], [data-choices] button[role="checkbox"]`
          )[position];
          button?.click();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, back, current, phase, embedded]);

  /* ── Rendu ───────────────────────────────────────────────────────────── */

  const total = questions.length + 1; // les questions, puis le créneau
  const progress = useMemo(() => {
    if (index === INTRO) return 0;
    if (phase !== "form") return Math.round(((questions.length + (phase === "done" ? 1 : 0.5)) / total) * 100);
    return Math.round((index / total) * 100);
  }, [index, total, phase, questions.length]);

  const setAnswer = (next: Answer) => {
    if (!current) return;
    const merged = { ...answersRef.current, [current.id]: next };
    answersRef.current = merged;
    setAnswers(merged);
    if (error) setError(null);
  };

  const inSlots = phase === "slots" || phase === "booking" || phase === "done";
  const screenKey = inSlots ? "slots" : index;

  return (
    <div ref={container} className={`${styles.shell} ${embedded ? styles.shellEmbedded : ""}`}>
      <div className={styles.progressTrack} aria-hidden>
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      </div>

      <header className={styles.head}>
        {!embedded && <Wordmark mark={wordmark} />}
        {index >= 0 && !inSlots && (
          <span className="eyebrow">
            Question {index + 1} / {questions.length}
          </span>
        )}
        {inSlots && <span className="eyebrow">Dernière étape</span>}
      </header>

      <div className={styles.stage}>
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={screenKey}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition.enter}
            className={styles.screen}
          >
            {inSlots ? (
              <>
                <h1 className={styles.label}>{form.slots.title}</h1>
                <p className={styles.help}>{form.slots.hint}</p>
                <div className={styles.fields}>
                  <SlotPicker
                    slots={slots}
                    busy={phase !== "slots"}
                    done={phase === "done"}
                    cta={form.slots.cta}
                    error={bookingError}
                    onRetry={fetchSlots}
                    onBook={book}
                  />
                </div>
              </>
            ) : index === INTRO ? (
              <div className={styles.intro}>
                <h1 className={styles.label}>{form.intro.title}</h1>
                <p className={styles.introBody}>{form.intro.body}</p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-deep)]"
                    onClick={() => void advance()}
                  >
                    {form.intro.cta}
                  </button>
                  <span className={styles.hint}>{W.pressEnter}</span>
                </div>
              </div>
            ) : (
              current && (
                <>
                  <h1 className={styles.label}>{current.label}</h1>
                  {current.help && <p className={styles.help}>{current.help}</p>}

                  <motion.div
                    className={styles.fields}
                    data-choices
                    // La secousse signale l'erreur sans déplacer le regard :
                    // le message seul passe inaperçu sur un grand écran.
                    key={`fields-${shake}`}
                    animate={shake > 0 ? { x: [0, -7, 7, -4, 0] } : undefined}
                    transition={{ duration: 0.28 }}
                  >
                    <QuestionView
                      question={current}
                      value={answers[current.id]}
                      error={error}
                      dialCountry={dialCountry}
                      onDialCountry={setDialCountry}
                      onChange={setAnswer}
                      onPick={() => {
                        window.clearTimeout(autoAdvance.current);
                        // Assez pour voir la coche, assez peu pour attendre.
                        autoAdvance.current = window.setTimeout(() => void advance(), 350);
                      }}
                      onSubmit={() => void advance()}
                    />
                  </motion.div>

                  {error && (
                    <p className={styles.error} role="alert" aria-live="assertive">
                      {error}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-deep)]"
                      onClick={() => void advance()}
                    >
                      {index === questions.length - 1 ? W.seeSlots : "OK"}
                      <span aria-hidden>✓</span>
                    </button>
                    <span className={styles.hint}>
                      {current.kind === "long"
                        ? W.cmdEnter
                        : W.pressEnter}
                    </span>
                  </div>
                </>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!inSlots && (
        <nav
          className={`${styles.nav} ${embedded ? styles.navEmbedded : ""}`}
          aria-label="Navigation dans le formulaire"
        >
          <button
            type="button"
            className={styles.navButton}
            onClick={back}
            disabled={index <= INTRO || phase !== "form"}
            aria-label="Question précédente"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => void advance()}
            disabled={phase !== "form"}
            aria-label="Question suivante"
          >
            ↓
          </button>
        </nav>
      )}
    </div>
  );
}
