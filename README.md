# Tunnel VSL

Un modèle de tunnel VSL complet : landing avec vidéo et décompte, formulaire
de candidature branché sur l'API iClosed (le lead y part dès ses coordonnées,
le créneau se réserve sans quitter la page), page de remerciement avec une
vidéo principale et six vidéos courtes, page d'immersion à deux vidéos,
tracking Meta, et une administration qui enregistre chaque visite, collecte
les UTM, montre l'entonnoir étape par étape et exporte tout en CSV.

Le branding est une couche remplaçable : deux fichiers et un dossier
d'images suffisent à le passer d'une marque à une autre, ou `/admin/apparence`
sans toucher au code.

Next.js 16 · React 19 · Postgres (Drizzle) · Tailwind 4 · Vercel.

---

## Partir de ce modèle

1. Sur GitHub : **Use this template → Create a new repository**, en privé. Le
   nouveau repo t'appartient, sans lien avec celui-ci.
2. Le cloner et l'essayer sans aucun compte (section suivante).
3. Pour la charte : `/admin/apparence` — couleurs, polices, logo — sans toucher
   au code.
4. Pour tout le reste, l'ouvrir dans Claude Code. Le fichier `CLAUDE.md` lui
   donne les règles du projet ; ce genre de demande marche telle quelle :
   - « Remplace les questions par celles-ci… »
   - « Passe tout le site au vouvoiement. »
   - « Ajoute une question éliminatoire sur le secteur. »
   - « Change le titre de la landing : … »
5. Déployer : section « Mise en production ».

---

## Essayer en local, sans aucun compte

```bash
pnpm install
pnpm preview:setup   # base embarquée + données de démonstration
pnpm preview
```

→ http://localhost:3000 — le tunnel, et l'administration ouverte sur
http://localhost:3000/admin. Aucune clé requise : sans clé iClosed, l'écran
de créneau dit « impossible de charger » (c'est l'état normal avant la
configuration), et les événements Meta ne partent nulle part tant qu'aucun
pixel n'est configuré. Pour re-tester le décompte sur un navigateur déjà
déverrouillé : `/?timer=reset`.

---

## Le parcours

```
ad ──► /  (VSL + décompte)  ──► /candidature  ──┬──► créneau iClosed ──► /merci  ──► /immersion
                                                │                        événement Meta (si trafic Meta)
                                                └──► /suite   hors critères · aucun événement, aucun créneau
```

- **La landing** : titre, réserve légale facultative, VSL, et la candidature
  derrière un décompte réglé dans l'administration — le formulaire lui-même
  sous la vidéo (`form: "inline"` dans `src/content/landing.ts`, le montage
  Savoire) ou un bouton vers `/candidature` (`form: "page"`).
- **Le formulaire** : une question par écran, clavier d'abord. Chaque écran
  validé part au serveur — un abandon reste mesurable — et **le lead part
  vers iClosed dès qu'il a laissé un email ou un numéro**, puis il y est mis
  à jour à chaque écran. Une réponse éliminatoire (le chiffre d'affaires, par
  défaut) sort du parcours sans créneau : le lead est enregistré quand même,
  c'est de la donnée de ciblage.
- **Le créneau** : les prochains jours pourvus, lus dans iClosed, réservés
  par l'API. Un double-clic ne crée jamais deux rendez-vous : la session sert
  de clé d'idempotence, iClosed n'en a aucune.
- **La page de remerciement** : bandeau « ton appel est réservé — lundi 2
  novembre à 10h00 », vidéo principale, six vidéos courtes qui répondent
  chacune à une objection, renvoi vers l'immersion. C'est là que part
  l'événement de conversion Meta — **uniquement si le serveur a vérifié la
  réservation, et uniquement si le trafic vient de Meta** (clic premier ou
  dernier). Forcer l'URL ne déclenche rien.
- **L'immersion** : deux vidéos avec leur sommaire, puis, au choix, les
  témoignages (les mêmes cartes que la landing) et un mur d'avis en
  captures. Aucun événement.

---

## Ce qui se modifie, et où

| Ce que tu veux changer | Où |
|---|---|
| **Couleurs, polices, logo, angles** | **`/admin/apparence`, sans code ni redéploiement** |
| **Clé et événement iClosed, pixel et token Meta, décompte** | **`/admin/reglages`, sans redéploiement** |
| Titre, réserve légale, VSL, bouton de la landing | `src/content/landing.ts` |
| Les questions, leur ordre, ce qui élimine, le mapping iClosed | `src/content/form.ts` |
| Vidéo principale, six vidéos courtes, bandeau, événement Meta | `src/content/thanks.ts` |
| Les deux vidéos d'immersion, leur sommaire, les témoignages et le mur d'avis | `src/content/immersion.ts` |
| La charte par défaut (quand rien n'est saisi dans l'administration) | `src/brand/tokens.css` et `src/brand/brand.ts` |
| Nom, mentions légales, réseaux, **tutoiement ou vouvoiement** (`address`) | `src/brand/brand.ts` |
| Polices auto-hébergées, image de partage, favicon | `public/brand/` |

Aucun composant n'écrit de couleur ni de nom de marque en dur. Tout passe par
les variables de `tokens.css` et par `BRAND` — et `pnpm check:brand`, lancé
avant chaque build, refuse toute teinte écrite en dur ailleurs.

### Poser une vidéo

Chaque emplacement vidéo accepte quatre formes :

```ts
{ provider: "vidalytics", embedId: "XXXX", baseUrl: "https://fast.vidalytics.com/embeds/COMPTE/XXXX/" }
{ provider: "wistia", id: "abc123defg" }
{ provider: "youtube", id: "dQw4w9WgXcQ" }
{ provider: "vimeo", id: "123456789" }
{ provider: "file", src: "/videos/vsl.mp4", poster: "/videos/vsl.jpg" }
```

La landing accepte aussi une ligne de preuve (`proof`, sous la vidéo) et une
section `testimonials` : une carte par client — sa vignette (`poster`, la
tête du client), son métier, et une accroche en surimpression dont le chiffre
entre `**` passe en gras ; cliquer ouvre la vidéo en calque.

Tant qu'un emplacement vaut `null`, la page montre une vignette d'attente
avec sa légende : on voit la mise en page avant d'avoir tourné.

### Changer les questions

Chaque question a un `kind` (`name`, `phone`, `email`, `single`, `multi`,
`short`, `long`), un `id` stable, et pour les choix des `options` dont
certaines peuvent porter `disqualifies`. Une question peut porter `iclosed` :
l'identifiant **nu** du champ iClosed qui reçoit sa réponse. Après chaque
modification : `pnpm check`, puis **Réglages → iClosed → Vérifier** dans
l'administration, qui interroge iClosed et dit si chaque champ est bien
rattaché à l'événement.

---

## L'administration

- **Tableau de bord** : visites de la landing, formulaire ouvert, leads
  démarrés, rendez-vous pris, immersion vue, avec les taux de passage ; puis
  l'**entonnoir** (un étage par question, les points sont les personnes
  arrêtées là, cliquer filtre la table) ; puis la **provenance** par
  `utm_source` et par `utm_campaign` (visites, leads, rendez-vous, taux) ;
  puis les derniers leads. Période : 7, 30, 90 jours ou tout.
- **Leads** : une ligne par visiteur dès le premier écran validé, avec
  l'étape atteinte, le statut, l'état iClosed, l'état Meta, la durée sur le
  formulaire et la provenance. Filtres par statut, étape, source, recherche.
  **Exporter CSV** reprend exactement les filtres de l'écran, une colonne
  par question.
- **Fiche d'un lead** : les réponses mot pour mot, le créneau, les
  identifiants iClosed et la dernière erreur, l'événement Meta et sa trace,
  les UTM. Un bouton rejoue l'événement Meta avec le même identifiant (donc
  sans doublon).
- **Export des visites** : depuis le tableau de bord, une ligne par
  chargement de page avec sa provenance.
- **Apparence** et **Réglages** : voir plus haut.
- **Relecture IA** (dans Réglages, facultatif) : le *pixel conditioning*.
  Avec une clé Anthropic et le profil recherché écrit dans vos mots, chaque
  réservation venue de Meta est relue avant que l'événement ne parte ; seules
  les candidatures dans la cible et sincères remontent, Meta apprend à
  ramener celles-là. Le rendez-vous est pris dans tous les cas ; le verdict et
  son motif sont sur la fiche du lead et dans l'export. Sans clé, rien ne
  change : l'événement part dès que le trafic vient de Meta.

---

## Mise en production

### 1. Base de données

N'importe quel Postgres. Le plus simple est gratuit : dans le projet Vercel,
Storage → Create Database → **Neon** (Marketplace, plan gratuit), rattachée
au projet. L'intégration pose `DATABASE_URL` toute seule, et **les tables
se créent au premier déploiement** : le script `vercel-build` joue les
migrations avant `next build`. Rien à lancer à la main.

Avec Supabase : créer un projet, récupérer Project Settings → Database →
Connection string (URI, pooler, **mode session**, port 5432) et la poser
dans Vercel sous `DATABASE_URL`. Les tables se créent au build de la même
façon.

Pour un Postgres hébergé ailleurs que derrière Vercel, ou pour jouer les
migrations depuis un poste :

```bash
cp .env.example .env.local   # remplir DATABASE_URL, ADMIN_PASSWORD, AUTH_SECRET
pnpm db:migrate              # crée les tables
```

`AUTH_SECRET` se génère avec `openssl rand -base64 32`. La changer révoque
toutes les sessions d'administration ouvertes.

### 2. Vercel

Projet Vercel avec **Root Directory = ce dossier**. Reporter les variables de
`.env.example` (sauf `DATABASE_URL` si Neon est rattachée), plus
`NEXT_PUBLIC_SITE_URL` sur le domaine de production. Déployer : le premier
build crée les tables.

### 3. iClosed

1. iClosed → Réglages → API : créer une clé. Elle commence par `iclosed_`, le
   préfixe fait partie du token.
2. Repérer l'identifiant numérique de l'événement à réserver (dans l'URL
   d'édition de l'événement).
3. `/admin/reglages` → coller la clé et l'identifiant → **Vérifier**. Le
   diagnostic dit si la clé répond, si l'événement existe, si chaque question
   mappée a son champ rattaché, et s'il y a des créneaux.
4. Faire une réservation de test, puis **relire la fiche du contact dans
   iClosed** : les réponses doivent y être. Un 201 de l'API ne prouve rien
   (voir `CLAUDE.md`).

### 4. Meta

1. `/admin/reglages` → coller l'identifiant du pixel (dataset) et le token
   Conversions API (Business Manager → utilisateur système, autorisé sur le
   dataset).
2. **Envoyer un test** avec un code de l'onglet « Événements de test »
   d'Events Manager : l'événement s'affiche en quelques secondes sans compter
   nulle part.
3. L'événement s'appelle `Schedule` par défaut (standard Meta, sélectionnable
   directement comme objectif de campagne). Pour un nom personnalisé, le
   changer dans `src/content/thanks.ts`, envoyer un test **sans** code, puis
   créer une conversion personnalisée dessus dans Events Manager.
4. **Vider le code de test avant de lancer les campagnes** : tant qu'il est
   renseigné, tous les événements partent en test.

### 5. Relecture IA (facultatif)

Pour n'envoyer à Meta que les candidatures qui vous intéressent :
`/admin/reglages` → Relecture IA → coller une clé Anthropic
(console.anthropic.com → API keys), écrire le profil recherché comme vous le
diriez à un setter, cocher « Relire », puis **Tester**. Comptez de l'ordre
d'un centime par réservation relue. Pour tester le tunnel ensuite sans
polluer Meta, écrivez « test » dans le nom ou l'email.

### 6. Vérifier

- Une réservation de test venue d'un lien avec `fbclid=test` : Events Manager
  la montre **une fois**, « Navigateur · Serveur » dédupliqués sur le même
  identifiant.
- La même réservation depuis un lien sans paramètre Meta : **rien** ne doit
  apparaître, et la fiche du lead dit « trafic hors Meta ».
- `/admin` : les chiffres du tableau de bord et l'export CSV correspondent.

---

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `pnpm preview` | tunnel + administration sur la base embarquée |
| `pnpm preview:setup` | **efface** et reconstruit la base d'aperçu |
| `pnpm dev` | serveur de développement sur la vraie base |
| `pnpm db:generate` | génère une migration après édition du schéma |
| `pnpm db:migrate` | applique les migrations à `DATABASE_URL` |
| `pnpm check` | vérifie le contenu et la couche de marque |
| `pnpm typecheck` · `pnpm lint` · `pnpm build` | contrôles habituels |

---

## Ce que le tunnel ne fait pas (encore)

- La relecture IA ne bloque pas le créneau : une candidature copiée-collée
  obtient son rendez-vous, elle est seulement retenue avant Meta. Le
  rendez-vous s'annule depuis iClosed.
- Pas d'email de confirmation : c'est iClosed qui l'envoie.
- Pas de bandeau de consentement aux cookies : le pixel se pose sans, comme
  sur la plupart des tunnels publicitaires. À ajouter si le contexte
  l'exige.
- Pas de purge automatique des leads anciens ; la politique de
  confidentialité annonce une conservation de deux ans, à faire respecter à
  la main.
