# Tunnel VSL

Ce fichier note ce qui ne se déduit pas du code : les pièges rencontrés, les
frontières à ne pas franchir, et les décisions déjà prises. Le reste se lit
dans les sources et dans `README.md`.

## Ce que c'est

Un **modèle** de tunnel VSL, transmissible : landing + décompte, formulaire
branché sur iClosed, page de remerciement (1 vidéo + 6 courtes), immersion
(2 vidéos), tracking Meta, administration avec entonnoir, provenance et
exports. Il sert de support de cours ; un client le redéploie avec sa charte,
ses vidéos et ses questions. Deux conséquences permanentes :

- **Rien de spécifique à une marque hors de `src/brand/` et `src/content/`.**
  Aucun composant n'écrit une couleur, une police ou un nom.
- **Rien qui exige un compte que le client n'a pas.** Un Postgres, un mot de
  passe, une clé iClosed suffisent. Meta est facultatif, la relecture IA
  aussi : sans clé Anthropic, le tunnel marche exactement comme avant.

Application autonome : aucune dépendance à un autre projet du repo. Le moteur
(base, administration, charte, formulaire) est une **copie** de celui de
`hiring/`, pas un import — c'est voulu, chaque dossier doit pouvoir être
extrait tel quel.

## Les trois règles qui gouvernent tout

1. **Le navigateur ne décide de rien.** Il envoie des réponses ; le serveur
   recalcule le verdict depuis la base (`computeVerdict`), et c'est lui qui
   décide de montrer les créneaux (`loadSlots` relit le verdict), de réserver
   (`bookSlot` le relit encore) et d'envoyer l'événement Meta. Forger l'URL de
   `/merci` ou sauter une question ne mène nulle part.
2. **Seule une réservation venue de Meta remonte à Meta.** `metaTouch`
   (`lib/meta-touch.ts`) dit si la session porte un clic Meta, premier ou
   dernier. Sans lui, ni le pixel sur `/merci` ni la Conversions API ne
   partent, et la fiche dit « trafic hors Meta » — ce n'est pas un envoi raté.
   Le bouton « Renvoyer » refuse aussi. Un rendez-vous venu de YouTube ou d'un
   email n'apprend rien à l'algorithme, et Meta se l'attribuerait sur une
   simple impression.
3. **La table `leads` est la source de vérité des opt-ins, pas iClosed.**
   iClosed ne reçoit que ce que la synchro a réussi à pousser ; l'erreur est
   notée sur le lead (`iclosed_error`). Comparer les deux listes en croyant
   iClosed exhaustif mène à de faux « leads manquants ».

## iClosed

Base `https://public.api.iclosed.io`, `Authorization: Bearer iclosed_…` — le
préfixe fait partie du token. Clé et identifiant d'événement vivent en base
(`/admin/reglages`), l'environnement sert de repli. **Le client (`lib/
iclosed.ts`) est `server-only`** : la clé donne accès à tout le compte.

Le lead part vers iClosed dès qu'on a son email ou son numéro, puis il y est
mis à jour à chaque écran, et une dernière fois juste avant la réservation.
L'envoi passe par `after()` : il ne retarde jamais l'écran suivant.

Pièges vérifiés sur un compte réel, tous capables d'échouer en silence :

- **Champs texte de contact plafonnés à 500 caractères**, prénom et nom à
  **25**. Une URL d'arrivée Meta (utm + fbclid) dépasse facilement : envoyée
  telle quelle, elle fait échouer la création de contact de **tout le trafic
  payant** pendant que l'organique passe. Tout est écrêté dans `iclosed.ts`.
- Téléphone en **format international strict** (« + » puis chiffres), sinon
  400. Normalisé par `lib/phone.ts` avant chaque envoi.
- Un doublon (email ou téléphone connu) fusionne le plus souvent en 201 avec
  l'id existant ; un 409 a aussi été observé — filet dans `createContact`.
  La fusion **écrase** nom et email du contact existant.
- `POST /v1/eventCalls` veut `dateTime` (pas `startTime`) en ISO **UTC
  suffixé `Z`** ; un décalage local est rejeté. L'id du rendez-vous répond
  dans `data.eventCall.data.id`.
- `POST /v1/events/eventDates` n'accepte que `linkPrefix` et `timeZone` et
  renvoie des **heures locales** (« 08:30 »), pas des instants : l'horodatage
  se reconstruit avec le décalage **du jour concerné** (`toInstant`), sinon
  tout se décale d'une heure au changement d'heure. `/v1/events/timeSlots`
  renvoie 404.
- `POST /v1/fields/inviteeAnswers` attache les réponses au contact. Trois
  pièges : une clé inconnue est **ignorée avec un 201** (un 201 ne prouve
  rien — relire le contact) ; chaque envoi **remplace** tout le jeu de
  réponses (toujours renvoyer l'ensemble, `buildFieldAnswers` le fait) ; un
  champ qui existe dans le compte mais **n'est pas rattaché à l'événement**
  fait rejeter tout le lot (400 « Invalid secondary question »). D'où
  `getEventForm`, qui lit les champs rattachés à l'envoi, et le fourre-tout
  `iclosedCatchAll` qui reçoit le reste, question et réponse.
- `identifier` attend l'identifiant **nu** (`qualification`), pas le slug
  préfixé (`call.qualification`). Se référer aux identifiants, jamais aux
  libellés : les libellés se renomment côté iClosed sans que les identifiants
  bougent.
- **Aucune idempotence.** Un double-clic crée deux rendez-vous. La
  déduplication est à nous : index unique sur `session_id`, et `bookSlot`
  répond `already` si un `iclosed_booking_id` existe.
- Limites : 20 requêtes / 10 s / endpoint.

Le diagnostic de `/admin/reglages` (`diagnose`) vérifie tout ça d'un clic :
à lancer après chaque changement de `form.ts`.

## La relecture IA (pixel conditioning)

Facultative, activée dans `/admin/reglages` avec une clé Anthropic et le
profil recherché rédigé par l'équipe. Code dans `lib/review.ts`, verdict sur
le lead (`review_verdict`, `review_reason`, `review_source`, `reviewed_at`).

- **Elle ne décide pas du rendez-vous, seulement de l'événement Meta.** Le
  rendez-vous est pris dans tous les cas (bloquer apprend à écrire un
  mensonge crédible), et le pixel comme la Conversions API suivent le même
  verdict (`outcomeFor` et `bookSlot`). « Renvoyer » refuse une candidature
  écartée.
- **Elle ne tourne que si un événement pourrait partir** : trafic Meta
  (`metaTouch`) et relecture activée. Hors Meta, rien à conditionner.
- **Trois sources, dans l'ordre** : gardes déterministes (identité de test,
  même texte collé sur plusieurs questions — `source: garde`, sans appel),
  le modèle (`source` = son identifiant), le repli (`source: repli`). Le
  repli **laisse passer** et le dit : motif sur la fiche, `console.error`
  dans le journal. Un repli silencieux ferait croire qu'on conditionne.
- **Le modèle est `REVIEW_MODEL`** (Opus 5.5, effort bas, sortie structurée
  zod, `fallbacks: "default"`). **La réflexion compte dans `max_tokens`** :
  le plafond est à 4 000, ne pas le redescendre — à 300, un autre tunnel
  rendait un JSON vide deux fois sur trois et passait tout en repli.
- Le modèle ne reçoit **jamais une coordonnée** : les questions `name`,
  `email` et `phone` sont retirées avant l'appel. Les critères et les
  questions forment le préfixe mis en cache ; les réponses viennent après.
- **Tester sans polluer Meta** : « test » dans le nom ou l'email, ou un
  domaine jetable — la garde coupe l'événement quel que soit le modèle.
  « Tester » dans les réglages relit une candidature d'exemple
  (`sampleAnswers`) sans toucher à un lead.

## Meta

- **Nom d'événement : `THANKS.metaEventName`**, `Schedule` par défaut — un
  événement standard, sélectionnable directement comme objectif. Un nom
  personnalisé (50 caractères max) exige une conversion personnalisée, et
  n'apparaît dans Events Manager qu'après un premier envoi réel. Standard →
  `fbq('track')`, personnalisé → `fbq('trackCustom')` : Meta refuse l'inverse
  (`lib/meta-events.ts`).
- Le même `event_id` (la session) au pixel et à la Conversions API : Meta
  dédoublonne. Le garde `sessionStorage` sur `/merci` évite un second tir au
  rechargement.
- **Version de l'API : `v26.0`** (29 juillet 2026). Chaque version vit environ
  deux ans ; à relire quand Meta annonce le remplacement.
- Pixel et token vivent en base, l'environnement est un repli. Le token n'est
  jamais réaffiché ; un champ vide le conserve.
- **Le code d'événement de test s'applique à TOUS les envois** tant qu'il est
  renseigné. À vider avant les campagnes.
- Jamais de donnée sensible dans un événement : ni réponse, ni chiffre
  d'affaires. Identité hachée seulement.

## Le formulaire

- **Le contenu est du code** : `src/content/form.ts`, validé par zod au
  chargement. Une faute casse le build, pas la production. L'entonnoir, la
  colonne « étape », les colonnes de l'export et la synchro iClosed en
  découlent (`lib/funnel.ts`).
- **Un `id` de question ne se renomme pas** : clé de stockage des réponses
  déjà reçues.
- **Une question éliminatoire doit venir avant les coordonnées** : sinon le
  lead part vers iClosed avant d'être écarté. `pnpm check` le refuse.
- **Client-seul** (`form-loader.tsx`, `ssr: false`) : le brouillon vit dans
  `sessionStorage` (`funnel_draft`), relu dans un initialiseur de `useState`.
  Un rendu serveur produirait l'écran d'accueil, aussitôt remplacé.
- **La validation lit `answersRef`, jamais l'état `answers`** : l'avance
  automatique d'un choix unique part d'un `setTimeout`, dont la fermeture
  date du rendu d'avant le clic. Y revenir ramènerait « Choisis une réponse »
  sur la réponse qu'on vient de choisir.
- Le créneau est une phase du même composant (`slots`), pas une page : le
  `stepReached` passe à `slots` à l'affichage, `booked` à la réservation.
- `100dvh`, champs à 16 px minimum, deux régimes d'animation : voir les
  commentaires de `form.module.css` et `application-form.tsx`.

## Le formulaire sous la vidéo

`LANDING.form: "inline"` monte le formulaire dans la landing, derrière le
décompte, en mode `embedded` : sans en-tête ni écran d'accueil, navigation
flottante dans la carte, et **le clavier n'est écouté que si le focus est
dans le formulaire** — sinon Entrée avancerait un formulaire qu'on ne regarde
pas en bas de page. `/candidature` redirige alors sur `/`, et l'entonnoir
perd l'étage « Visites du formulaire » (`VISIT_STAGES` lit `FORM_INLINE`).

## La page de remerciement

- Relit le lead par `sid` **côté serveur** (`outcomeFor`) : sans session
  réservée, redirection sur `/`. Le prénom et le créneau viennent de la base,
  pas de l'URL.
- Les six vidéos courtes ne montent leur lecteur qu'à l'ouverture du calque
  (`breakouts.tsx`). Une carte sans vidéo reste en place, « Vidéo à venir ».
- Six, pas cinq ni sept : le schéma (`thanksSchema`) l'impose, pour que la
  grille reste celle de la maquette.
- Vidalytics : plusieurs embeds sur une page demandent le snippet
  « secondary » (registre partagé), non porté ici. Pour les six courtes,
  préférer Wistia, YouTube, Vimeo ou un fichier ; Vidalytics va sur la
  principale. Wistia passe par son iframe officielle, en `loading="lazy"` :
  quatorze témoignages sur la landing ne chargent qu'en arrivant à l'écran.

## Le registre

`BRAND.address` (`tu` ou `vous`) pilote les phrases du moteur — messages
d'erreur, aides du formulaire, politique de confidentialité — par
`src/lib/wording.ts` (`t(tu, vous)` et le dictionnaire `W`). Toute nouvelle
phrase visible par le visiteur passe par là, jamais en dur dans un composant.
Le contenu de `src/content/` est écrit à la main dans le registre choisi.

## L'apparence

Deux couches, identiques à `hiring/` : `src/brand/tokens.css` + `brand.ts`
(la charte par défaut, écrite à la main) et `/admin/apparence` (des
surcharges en base, injectées par `<BrandStyle>` dans les layouts publics
seulement). Cinq couleurs, le reste est dérivé (`lib/appearance.ts`, pur,
sans `server-only` — l'aperçu en direct recalcule la même chose dans le
navigateur). Les polices Google se chargent par `<link>`, jamais par
`@import`. `pnpm check:brand` refuse toute teinte en dur hors de `src/brand/`.

## Base de données

Trois tables : `visits`, `leads`, `settings`. Les questions ne sont **pas**
des colonnes — réponses en JSON indexé par id, ajouter une question n'est
jamais une migration.

L'aperçu local est un PGlite dans `.preview-db`, sidecar sur
**`127.0.0.1:5504`** (5502 = platform, 5503 = hiring). La socket n'accepte
**qu'une connexion** : arrêter `pnpm preview` avant `pnpm preview:setup`, qui
**efface** et reconstruit avec 240 sessions de démonstration (`seed-preview.ts`,
générateur déterministe).

Après un `drizzle-kit generate`, la prod se met à jour **au build Vercel** :
`vercel-build` lance `scripts/migrate.ts` avant `next build`, parce qu'une
base du Marketplace (Neon) ne livre pas son URL en clair — `vercel env pull`
la rend vide. `pnpm db:migrate` reste pour un Postgres hébergé ailleurs.
Deux gardes valent pour tout déploiement, surtout sur Supabase :

- **Table de migrations dédiée** (`drizzle.__vsl_funnel_migrations`). Si la
  base est partagée avec une autre application Drizzle, la table par défaut
  ferait sauter des migrations.
- **RLS activé sans policy** sur les trois tables (`drizzle/0001_rls.sql`,
  écrite à la main, inscrite dans `_journal.json` sans snapshot). Sur
  Supabase, le schéma public est exposé par l'API REST avec la clé anonyme :
  sans RLS, les leads se liraient depuis n'importe quel navigateur.

Sur Supabase, prendre le pooler en **mode session** (port 5432) : en mode
transaction, des requêtes banales lancées en parallèle restent bloquées en
phase PARSE jusqu'au `statement_timeout`.

Une requête groupée sur un champ JSON doit **inliner** le nom du champ
(`sql.raw`) : passé en paramètre, `select` et `group by` reçoivent des
numéros différents et Postgres ne reconnaît plus la même expression
(`provenance.tsx`).

## Vérifier dans un navigateur

`pnpm preview` sert tout. Deux pièges du panneau d'aperçu quand il n'est
**pas affiché** : `setTimeout` et `requestAnimationFrame` sont gelés (les
transitions ne progressent qu'à chaque capture, l'avance automatique d'un
choix unique ne part jamais), et les frappes clavier n'atteignent pas la
page. Pour dérouler le formulaire : poser le brouillon dans `sessionStorage`
(`funnel_draft`, `{ index, answers }`) puis recharger, et utiliser
`form_input` plutôt que la frappe. Les promesses se résolvent normalement.

Sans clé iClosed, l'écran de créneau affiche « Impossible de charger » avec
« Réessayer » : c'est l'état attendu, pas un bug. Les sessions de démo
`demo-NNN` servent à ouvrir `/merci?sid=demo-NNN` (réservée) ou
`/suite?sid=demo-NNN` (hors critères).

## Habitudes

- Écrire en français : commentaires, copy, messages de commit.
- Vérifier dans le navigateur avant d'annoncer que quelque chose marche —
  capture ou mesure, pas seulement un build qui passe.
- `pnpm check` après toute édition de `src/content/`, puis **Réglages →
  iClosed → Vérifier** dans l'administration si le formulaire a changé.
