import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/brand/brand";

/**
 * Mentions légales — gabarit alimenté par `brand.ts`.
 *
 * Les champs absents de `brand.ts` (adresse, immatriculation) affichent une
 * consigne visible plutôt que du vide : mieux vaut voir qu'il manque quelque
 * chose que de publier une page qui a l'air complète et ne l'est pas.
 */
export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: false, follow: true },
};

function Missing({ what }: { what: string }) {
  return (
    <span className="rounded bg-[var(--warn-bg)] px-1.5 py-0.5 text-[var(--warn-text)]">
      À renseigner dans src/brand/brand.ts — {what}
    </span>
  );
}

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-10 sm:py-24">
      <h1 className="font-display text-[clamp(30px,4.4vw,44px)]">Mentions légales</h1>

      <div className="mt-12 flex flex-col gap-10">
        <section>
          <h2 className="font-display text-[22px]">Éditeur</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            {BRAND.legalName}
            <br />
            {BRAND.contact.address ?? <Missing what="adresse du siège" />}
            <br />
            {BRAND.contact.registration ?? <Missing what="numéro d'immatriculation" />}
            <br />
            {BRAND.contact.email}
          </p>
        </section>

        <section>
          <h2 className="font-display text-[22px]">Hébergement</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            {BRAND.host.name}
            <br />
            {BRAND.host.address}
          </p>
        </section>

        <section>
          <h2 className="font-display text-[22px]">Données personnelles</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            Le traitement des données du formulaire est décrit dans la{" "}
            <Link href="/confidentialite" className="text-[var(--link)]">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
