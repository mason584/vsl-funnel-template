"use client";

import dynamic from "next/dynamic";
import type { Form } from "@/content/types";
import { Wordmark } from "@/components/ui/primitives";
import type { ResolvedWordmark } from "@/lib/appearance";
import styles from "./form.module.css";

/**
 * Le formulaire est chargé côté navigateur uniquement.
 *
 * Son état initial vit dans `sessionStorage` — le brouillon de quelqu'un qui
 * recharge à la question 5. Un rendu serveur ne peut pas le connaître : il
 * produirait l'écran d'accueil, aussitôt remplacé par la bonne question, et le
 * visiteur croirait avoir tout perdu.
 *
 * Le rendre client-seul supprime le problème à la racine plutôt que de le
 * rattraper après coup, et le squelette ci-dessous occupe la place le temps du
 * chargement.
 */
const ApplicationForm = dynamic(
  () => import("./application-form").then((m) => m.ApplicationForm),
  {
    ssr: false,
    loading: () => (
      <div className={styles.shell}>
        <div className={styles.progressTrack} aria-hidden />
        <header className={styles.head}>
          <Wordmark />
        </header>
        <div className={styles.stage} aria-hidden />
      </div>
    ),
  }
);

export function FormLoader({
  form,
  defaultDialCountry,
  wordmark,
  embedded = false,
}: {
  form: Form;
  defaultDialCountry: string;
  wordmark: ResolvedWordmark;
  /** Sous la vidéo de la landing : sans en-tête, sans écran d'accueil, sans navigation fixe. */
  embedded?: boolean;
}) {
  return (
    <ApplicationForm
      form={form}
      defaultDialCountry={defaultDialCountry}
      wordmark={wordmark}
      embedded={embedded}
    />
  );
}
