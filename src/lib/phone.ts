/**
 * Téléphones du tunnel : sélection d'indicatif côté formulaire, normalisation
 * côté serveur avant stockage.
 *
 * Un seul format est conservé : « + » puis chiffres seuls, le format
 * international. C'est celui que Meta sait apparier une fois haché, celui
 * qu'un lien `tel:` ou WhatsApp comprend, et celui qu'attendent la plupart des
 * CRM — un « 06 12 34 56 78 » stocké tel quel est inutilisable hors de France.
 *
 * Sans `server-only` : ce module est importé par le formulaire (navigateur)
 * comme par les actions (serveur).
 */

import { W } from "@/lib/wording";

export type Country = {
  /** Code ISO 3166-1 alpha-2, tel que le renvoie `x-vercel-ip-country`. */
  iso: string;
  name: string;
  flag: string;
  dial: string;
  /**
   * Bornes du numéro national, zéro de tête exclu — c'est la validation qui
   * attrape le chiffre oublié ou en trop avant l'enregistrement.
   */
  nsn: [number, number];
  /**
   * L'Italie garde son zéro initial en format international (+39 06…) : ne
   * jamais le retirer. Partout ailleurs dans cette table, un 0 qui suit
   * l'indicatif est le préfixe national, à supprimer.
   */
  keepTrunkZero?: boolean;
};

/** L'ordre est celui du menu : la francophonie d'abord, le marché principal en tête. */
export const COUNTRIES: Country[] = [
  { iso: "FR", name: "France", flag: "🇫🇷", dial: "+33", nsn: [9, 9] },
  { iso: "BE", name: "Belgique", flag: "🇧🇪", dial: "+32", nsn: [8, 9] },
  { iso: "CH", name: "Suisse", flag: "🇨🇭", dial: "+41", nsn: [9, 9] },
  { iso: "LU", name: "Luxembourg", flag: "🇱🇺", dial: "+352", nsn: [6, 9] },
  { iso: "MC", name: "Monaco", flag: "🇲🇨", dial: "+377", nsn: [8, 9] },
  { iso: "MA", name: "Maroc", flag: "🇲🇦", dial: "+212", nsn: [9, 9] },
  { iso: "DZ", name: "Algérie", flag: "🇩🇿", dial: "+213", nsn: [9, 9] },
  { iso: "TN", name: "Tunisie", flag: "🇹🇳", dial: "+216", nsn: [8, 8] },
  { iso: "SN", name: "Sénégal", flag: "🇸🇳", dial: "+221", nsn: [9, 9] },
  { iso: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dial: "+225", nsn: [10, 10] },
  { iso: "CM", name: "Cameroun", flag: "🇨🇲", dial: "+237", nsn: [9, 9] },
  { iso: "MG", name: "Madagascar", flag: "🇲🇬", dial: "+261", nsn: [9, 9] },
  { iso: "MU", name: "Maurice", flag: "🇲🇺", dial: "+230", nsn: [7, 8] },
  { iso: "RE", name: "La Réunion", flag: "🇷🇪", dial: "+262", nsn: [9, 9] },
  { iso: "GP", name: "Guadeloupe", flag: "🇬🇵", dial: "+590", nsn: [9, 9] },
  { iso: "MQ", name: "Martinique", flag: "🇲🇶", dial: "+596", nsn: [9, 9] },
  { iso: "GF", name: "Guyane", flag: "🇬🇫", dial: "+594", nsn: [9, 9] },
  { iso: "PF", name: "Polynésie", flag: "🇵🇫", dial: "+689", nsn: [8, 8] },
  { iso: "NC", name: "Nouvelle-Calédonie", flag: "🇳🇨", dial: "+687", nsn: [6, 6] },
  { iso: "AE", name: "Émirats", flag: "🇦🇪", dial: "+971", nsn: [8, 9] },
  { iso: "QA", name: "Qatar", flag: "🇶🇦", dial: "+974", nsn: [8, 8] },
  { iso: "SA", name: "Arabie saoudite", flag: "🇸🇦", dial: "+966", nsn: [8, 9] },
  { iso: "IL", name: "Israël", flag: "🇮🇱", dial: "+972", nsn: [8, 9] },
  { iso: "GB", name: "Royaume-Uni", flag: "🇬🇧", dial: "+44", nsn: [9, 10] },
  { iso: "DE", name: "Allemagne", flag: "🇩🇪", dial: "+49", nsn: [7, 11] },
  { iso: "ES", name: "Espagne", flag: "🇪🇸", dial: "+34", nsn: [9, 9] },
  { iso: "PT", name: "Portugal", flag: "🇵🇹", dial: "+351", nsn: [9, 9] },
  { iso: "IT", name: "Italie", flag: "🇮🇹", dial: "+39", nsn: [9, 11], keepTrunkZero: true },
  { iso: "NL", name: "Pays-Bas", flag: "🇳🇱", dial: "+31", nsn: [9, 9] },
  { iso: "US", name: "États-Unis", flag: "🇺🇸", dial: "+1", nsn: [10, 10] },
  { iso: "CA", name: "Canada", flag: "🇨🇦", dial: "+1", nsn: [10, 10] },
  { iso: "TH", name: "Thaïlande", flag: "🇹🇭", dial: "+66", nsn: [8, 9] },
  { iso: "SG", name: "Singapour", flag: "🇸🇬", dial: "+65", nsn: [8, 8] },
  { iso: "HK", name: "Hong Kong", flag: "🇭🇰", dial: "+852", nsn: [8, 8] },
];

/** Pays présélectionné dans le menu — la France quand le pays est inconnu d'ici. */
export function defaultCountry(iso: string | null | undefined): string {
  const code = (iso ?? "").toUpperCase();
  return COUNTRIES.some((c) => c.iso === code) ? code : "FR";
}

export function dialFor(iso: string): string {
  return COUNTRIES.find((c) => c.iso === iso)?.dial ?? "+33";
}

export type PhoneCheck =
  | { ok: true }
  | { ok: false; hint: string };

/**
 * Longueur du numéro saisi face au pays choisi — le filet qui attrape le
 * chiffre oublié avant l'écran de créneau. Une saisie déjà internationale
 * (« + » ou « 00 ») échappe au menu : on ne vérifie qu'une longueur globale.
 */
export function checkPhone(rawInput: string, iso: string): PhoneCheck {
  const raw = rawInput.trim();
  let digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+") || raw.startsWith("00")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15
      ? { ok: true }
      : { ok: false, hint: "Ce numéro international n'a pas un nombre de chiffres plausible." };
  }

  const country = COUNTRIES.find((c) => c.iso === iso);
  if (!country) {
    return digits.length >= 7 && digits.length <= 15
      ? { ok: true }
      : { ok: false, hint: "Numéro trop court pour être valide." };
  }

  if (!country.keepTrunkZero && digits.startsWith("0")) digits = digits.slice(1);
  const [min, max] = country.nsn;
  if (digits.length >= min && digits.length <= max) return { ok: true };

  const expected = min === max ? `${min} chiffres` : `${min} à ${max} chiffres`;
  return {
    ok: false,
    hint: `Un numéro ${country.flag} ${country.dial} compte ${expected} — ${W.phoneRecount}.`,
  };
}

/** « +33 06 12… » : un zéro national collé à l'un de nos indicatifs, à retirer. */
const TRUNK_ZERO = new RegExp(
  `^\\+(${[...new Set(COUNTRIES.filter((c) => !c.keepTrunkZero).map((c) => c.dial.slice(1)))]
    .sort((a, b) => b.length - a.length)
    .join("|")})0(\\d{6,})$`
);

export function normalizePhone(raw: string, dialCode = "+33"): string | undefined {
  let digits = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  digits = digits.replace(TRUNK_ZERO, "+$1$2");
  // Numéro resté national malgré tout : préfixé par l'indicatif fourni.
  if (/^0\d{8,9}$/.test(digits)) digits = `${dialCode}${digits.slice(1)}`;
  return digits.replace("+", "").length >= 2 ? digits : undefined;
}
