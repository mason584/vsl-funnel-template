import type { Metadata } from "next";
import { BRAND } from "@/brand/brand";
import { t } from "@/lib/wording";

/**
 * Politique de confidentialité — gabarit alimenté par `brand.ts`.
 *
 * Obligatoire dès lors qu'on collecte des coordonnées et qu'on pose un pixel
 * publicitaire. Le texte couvre les mentions attendues par le RGPD :
 * responsable, finalité, base légale, durée, destinataires, droits. À faire
 * relire par un juriste avant une mise en production sérieuse.
 */
export const metadata: Metadata = {
  title: "Confidentialité",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  const years = Math.round(BRAND.retentionMonths / 12);

  const sections: { title: string; body: string[] }[] = [
    {
      title: t("Qui traite tes données", "Qui traite vos données"),
      body: [
        `${BRAND.legalName} est responsable du traitement des données collectées sur ce site. Pour toute question, ${t("écris", "écrivez")} à ${BRAND.contact.email}.`,
      ],
    },
    {
      title: "Ce qu'on collecte, et pourquoi",
      body: [
        t(
          "Les réponses que tu donnes dans le formulaire : ton identité, tes coordonnées, et les éléments qui décrivent ton activité. Ces informations servent uniquement à préparer l'appel que tu demandes et à te recontacter.",
          "Les réponses que vous donnez dans le formulaire : votre identité, vos coordonnées, et les éléments qui décrivent votre activité. Ces informations servent uniquement à préparer l'appel que vous demandez et à vous recontacter."
        ),
        t(
          "Des données de fréquentation : les pages consultées, la provenance de ta visite (campagne publicitaire, lien direct) et des identifiants techniques. Elles servent à mesurer l'efficacité de nos publicités.",
          "Des données de fréquentation : les pages consultées, la provenance de votre visite (campagne publicitaire, lien direct) et des identifiants techniques. Elles servent à mesurer l'efficacité de nos publicités."
        ),
      ],
    },
    {
      title: "Sur quelle base légale",
      body: [
        t(
          "La prise de rendez-vous relève des mesures précontractuelles prises à ta demande. La mesure d'audience publicitaire repose sur notre intérêt légitime à savoir quelles publicités amènent des rendez-vous.",
          "La prise de rendez-vous relève des mesures précontractuelles prises à votre demande. La mesure d'audience publicitaire repose sur notre intérêt légitime à savoir quelles publicités amènent des rendez-vous."
        ),
      ],
    },
    {
      title: "Combien de temps",
      body: [
        `${t("Tes", "Vos")} réponses sont conservées ${BRAND.retentionMonths} mois (soit ${years} an${years > 1 ? "s" : ""}) après notre dernier échange. Passé ce délai, elles sont supprimées.`,
      ],
    },
    {
      title: "Qui d'autre y a accès",
      body: [
        `L'équipe de ${BRAND.legalName} chargée des appels. Nos prestataires techniques traitent les données pour notre compte : ${BRAND.host.name} (hébergement du site et de la base) et iClosed (prise de rendez-vous).`,
        t(
          "Si tu réserves un appel, une information de conversion est transmise à Meta pour mesurer nos campagnes publicitaires. Elle ne contient ni tes réponses ni ton chiffre d'affaires : uniquement des identifiants chiffrés à sens unique.",
          "Si vous réservez un appel, une information de conversion est transmise à Meta pour mesurer nos campagnes publicitaires. Elle ne contient ni vos réponses ni votre chiffre d'affaires : uniquement des identifiants chiffrés à sens unique."
        ),
      ],
    },
    {
      title: t("Tes droits", "Vos droits"),
      body: [
        `${t("Tu peux", "Vous pouvez")} demander l'accès à ${t("tes", "vos")} données, leur correction, leur suppression, ou ${t("t'opposer", "vous opposer")} à leur traitement, en écrivant à ${BRAND.contact.email}. ${t("Tu peux", "Vous pouvez")} également introduire une réclamation auprès de la CNIL.`,
      ],
    },
    {
      title: "Cookies et traceurs",
      body: [
        "Ce site utilise le pixel de mesure Meta pour attribuer les rendez-vous aux campagnes publicitaires. " +
          t("Tu peux le bloquer via les réglages de ton navigateur", "Vous pouvez le bloquer via les réglages de votre navigateur") +
          " ou une extension de blocage : le formulaire fonctionne sans lui.",
      ],
    },
  ];

  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-10 sm:py-24">
      <h1 className="font-display text-[clamp(30px,4.4vw,44px)]">Confidentialité</h1>
      <p className="mt-4 text-[var(--text-muted)]">
        Comment {BRAND.legalName} traite les données des visiteurs.
      </p>

      <div className="mt-12 flex flex-col gap-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-[22px]">{section.title}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-[var(--text-secondary)]">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
