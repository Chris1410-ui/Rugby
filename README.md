# Rugby Player Performance Platform — Belgique U18

Migration du prototype `localStorage` (mono-navigateur) vers une **vraie application
multi-utilisateurs** avec backend **Supabase** (Postgres + Auth + RLS + Realtime).

Stack : **React + Vite** · **Supabase** (EU / Francfort, `eu-central-1` — RGPD).

Ce dépôt implémente la migration décrite dans `MIGRATION_localStorage_to_supabase.md`,
en suivant l'ordre recommandé. **Étape 1–2 livrées** : schéma Supabase + Auth.

---

## État d'avancement

| # | Étape (MIGRATION §6) | État |
|---|----------------------|------|
| 1 | `SUPABASE_SCHEMA.sql` (tables, RLS, Realtime) | ✅ appliqué |
| 2 | Auth + `profiles` (rôles) + création de profil joueur | ✅ fait |
| 3 | `players` (liste, CRUD, création joueur) | ✅ effectif temps réel + ajout staff |
| 4 | `daily_checkins` + `session_logs` | ✅ bilan quotidien + logging set-par-set (Realtime) |
| 5 | `lib/metrics.js` branché sur tous les dashboards | ✅ `useTeamData` → `enrichPlayers` (source unique, aucun recalcul écran) |
| 6 | `messages` + Realtime + alertes + reco IA (Edge Function) | ✅ messagerie temps réel, récap hebdo, alertes, recommandations Claude serveur |
| 7 | `programs`/`sessions`/`routines`/`exercises`, import PDF, export CSV | ✅ programmes (matérialisent les séances), routines, bibliothèque, import PDF, export CSV |
| 8 | Storage (PDF/vidéos) + recommandations Claude (Edge Function) | ✅ bucket privé aligné équipe (URLs signées) · Edge Function reco |
| + | Écrans secondaires : classement, calendrier, fiche, comparaison, veille | ✅ tous branchés sur `enrichPlayers` (aucun recalcul écran) |

---

## Démarrage

```bash
npm install
cp .env.example .env      # puis renseigner les valeurs (voir ci-dessous)
npm run dev               # http://localhost:5173
npm test                  # tests unitaires (Vitest)
npm run lint              # ESLint
```

### Tests & qualité

- **Vitest** — tests unitaires du cœur métier (`src/lib/metrics.test.js` :
  zones ACWR, `wbToWellness`, `computeReadiness`, déterminisme de `playerLoad`,
  cohérence de `enrichPlayers`, `computePoints`) + utilitaires (`password`,
  `resolveAssignedIds`/`dbToSession`). 23 tests.
- **ESLint** (flat config, plugins react-hooks/react-refresh) — 0 avertissement.

### Variables d'environnement (`.env`)

Valeurs **publiques** (côté navigateur) du projet Supabase — jamais de clé secrète ici :

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...        # clé publishable (ou anon)
```

Le projet cible est hébergé en **UE (Francfort)** conformément à l'exigence RGPD
(données de santé de mineurs — cf. handoff §10).

---

## Base de données

Le schéma (`SUPABASE_SCHEMA.sql`) est appliqué via deux migrations Supabase :

1. `init_rugby_schema` — enums, 10 tables (`teams`, `profiles`, `players`, `exercises`,
   `programs`, `sessions`, `session_logs`, `daily_checkins`, `messages`, `routines`),
   **RLS stricte** (staff = son équipe ; joueur = ses données), fonctions helper
   `SECURITY DEFINER` (`my_team`, `is_staff`, `my_player_id`), publication Realtime.
2. `auth_profile_trigger_and_team_seed` — seed des équipes + trigger
   `on_auth_user_created` qui, à l'inscription, crée le `profile` (rôle, équipe) et,
   pour un joueur qui s'inscrit, la ligne `players` auto-liée (`is_custom=true`,
   `owner_uid`), le tout côté serveur (`SECURITY DEFINER`).

Vérifications effectuées : trigger attaché, création profil+joueur liée, isolation RLS
(staff voit toute l'équipe, joueur ne voit que lui-même).

### Auth — remplace le SHA-256 du prototype

- Le hachage client (`hashPwd` / clés `pwd:*`) est **supprimé**. Mots de passe gérés
  par Supabase Auth (bcrypt serveur).
- Inscription : `supabase.auth.signUp` avec métadonnées `{role, team_id, full_name, …}`
  → le trigger crée profil (+ joueur). Connexion : `signInWithPassword`.
  Mot de passe oublié : `resetPasswordForEmail`.
- Critères de robustesse du prototype conservés (jauge de force) à titre indicatif.

> **Confirmation d'email.** Par défaut Supabase demande une confirmation par email.
> Pour un flux « inscription → session immédiate » (équipe fermée / démo), désactive
> *Authentication → Providers → Email → Confirm email* dans le dashboard. Sinon, le
> profil est bien créé à l'inscription mais l'utilisateur doit confirmer avant de se
> connecter.

---

## Recommandations IA (Edge Function)

La fonction `recommendations` génère des conseils de charge/prévention par joueur.
**L'appel à Claude et la clé API restent côté serveur** (jamais exposés au navigateur,
cf. handoff §10). Le client l'invoque via `supabase.functions.invoke('recommendations')`.

Configuration (secrets de la fonction, non commités) :

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ANTHROPIC_MODEL=<model-id>
```

Sans ces secrets, la fonction renvoie une **recommandation de repli déterministe**
dérivée des indicateurs — la feature reste fonctionnelle sans clé.

## Stockage (bucket privé + URLs signées)

Bucket **privé** `team-files` (aucune URL publique). Convention de chemin, dont le
1er segment (= `team_id`) porte la RLS :

```
<team_id>/programs/<program_id>/<fichier>   PDF de programmes
<team_id>/videos/<clé>/<fichier>            vidéos d'analyse
```

Politiques `storage.objects` : **lecture** par les membres de l'équipe,
**écriture** réservée au staff (via `public.my_team()` / `public.is_staff()`).
Tout accès en lecture passe par une **URL signée** à durée limitée
(`createSignedUrl`, 1 h) — jamais d'URL publique. Le PDF importé pour créer un
programme y est archivé automatiquement ; le staff peut aussi joindre des vidéos
(écran Programmes → bouton *Fichiers*).

## Architecture du code

```
src/
  lib/
    supabase.js     client Supabase (session persistée, refresh auto)
    metrics.js      MOTEUR MÉTIER porté tel quel (source de vérité UNIQUE) :
                    playerLoad, wbToWellness, computeReadiness, enrichPlayers,
                    computePoints, buildAlerts, zones ACWR
    tokens.js       design tokens (palette, sports, équipes, rôles)
    positions.js    postes / groupes (grp aligné sur l'enum SQL)
    password.js     robustesse mot de passe (indicatif)
    icons.jsx       icônes SVG inline (style Lucide)
  auth/
    useAuth.jsx     contexte session + profil
    LoginScreen.jsx écran connexion / inscription (rôle → équipe → nom → email/mdp)
    hevy.js         historique par exercice (perf préc., records, 1RM Epley)
    ui.jsx          atomes UI (Ring, Section, KPI, Tag, Dot, RestTimer, BottomNav…)
  data/
    players.js      effectif temps réel (Realtime) + ajout staff, mapper DB→métier
    checkins.js     bilans (upsert par player_id,date) + map pour enrichPlayers
    sessions.js     séances (read + création staff), résolution des assignés
    logs.js         logs de séance (upsert par session_id,player_id)
    messages.js     messagerie (fil, envoi, accusé de réception) + Realtime
    programs.js     programmes → matérialisation de séances datées + Realtime
    routines.js     modèles de séances réutilisables
    exercises.js    bibliothèque (catalogue global + perso)
    storage.js      bucket privé `team-files` (upload staff, URLs signées)
    recommendations.js  invoque l'Edge Function `recommendations`
    useTeamData.js  AGRÉGATION → enrichPlayers (source de vérité unique côté client)
  lib/  … + csv.js (export CSV), pdf.js (import PDF, pdf.js dynamique), exlib.js
  screens/
    AppShell.jsx        coquille authentifiée (header + routage rôle)
    shared/             Thread, Classement (gamification), Calendrier (jours loggés),
                        Fiche (détaillée, éditable staff), Veille (bibliographie)
    player/             Bilan, Seances, SessionPlayCard, Messages, Comparaison, PlayerApp
    staff/              StaffApp (Effectif+CSV+fiche, Aujourd'hui, Alertes, Programmes,
                        Exos, Classement, Calendrier, Veille), Programmes, Bibliotheque
  App.jsx           routage session ↔ login
  main.jsx

supabase/
  functions/recommendations/  Edge Function : appel Claude côté serveur
                              (clé API jamais exposée ; repli déterministe si non configurée)
  migrations/                 schéma + RLS + trigger auth
```

**Règle d'or conservée** : aucune duplication de formule. Tous les écrans liront le
résultat de `enrichPlayers` (cf. `MIGRATION §5`).

---

## Références (non versionnées dans l'app)

`RugbyApp.jsx`, `PerformanceU18.standalone.html`, `PROMPT.md`, `SUPABASE_SCHEMA.sql`,
`MIGRATION_localStorage_to_supabase.md` sont les documents de handoff (design + logique
métier + schéma). Le code de production les réutilise comme spécification.
