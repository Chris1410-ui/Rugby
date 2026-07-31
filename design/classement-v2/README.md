# Classement rugby — livrables

Prototype web responsive, deux surfaces reliées par un journal d'événements partagé.
Tout est autonome : aucun serveur, aucune dépendance, aucun accès réseau requis.

## Fichiers

| Fichier | Rôle |
|---|---|
| `classement.html` | **Vue joueur** — écran principal. Classement, podium, module « Aujourd'hui » (check-in, série, gel, duel du jour, mission hebdo, encouragements), notifications de duel, panneau détail par joueur. |
| `staff.html` | **Console staff** — fil d'activité en direct, feuille de présence (avec saisie à une date antérieure sur 7 jours), suivi du décrochage, relances. |
| `classement-rugby-responsive.html` | Version précédente, conservée pour comparaison (classement seul, sans boucle quotidienne). |
| `ms8xuahs-classement-export.html` | Export d'origine, intact. Source du barème et des données. |

## Comment ouvrir

Double-clic sur `classement.html` dans un navigateur (Chrome, Safari, Firefox, Edge).
Depuis l'en-tête, le lien **Staff** ouvre `staff.html`.

Pour que les deux surfaces communiquent, gardez les **deux onglets ouverts dans le même
navigateur** : le journal d'événements est diffusé entre onglets en direct.

## Démonstration de la boucle complète (2 min)

1. Ouvrir `classement.html`, puis `staff.html` dans un second onglet.
2. Dans la console staff, **Feuille de présence** → sélectionner la date **d'hier** → cocher
   `Loup` → valider.
3. Refaire l'opération sur la date **d'aujourd'hui** pour le même joueur.
4. Revenir sur l'onglet joueur : le classement bouge et la notification
   « Loup vient de te repasser » part dans la seconde, avec l'écart réel.

Autres parcours à essayer :
- Console staff → **Relancer** un joueur → la relance arrive côté joueur comme notification
  avec le bouton de validation dedans.
- Vue joueur → **Valider ma séance** → les points s'ajoutent en direct, le rang se recalcule,
  et la validation apparaît dans le fil staff.

## Ce qui est réel, ce qui ne l'est pas

- Le barème (`+8` par séance, jusqu'à `+5` de bonus de série, `+15` pour la mission hebdo),
  les seuils de division, le rang partagé et les paliers de défis viennent de l'export d'origine.
- Les 20 profils sont pseudonymisés (totem + initiales).
- Les points gagnés pendant la démo sont **stockés sur l'appareil** (localStorage) et signalés
  comme tels en pied de page. Vider les données du navigateur remet le prototype à zéro.
- Le fil d'activité staff démarre **vide** : rien n'est pré-rempli ni simulé.

## Ce qui manque pour un déploiement réel

Une file d'événements côté serveur. Aujourd'hui le journal traverse les onglets d'un même
navigateur, pas les appareils. C'est la seule pièce d'infrastructure nécessaire pour que la
boucle joueur ↔ staff fonctionne en vrai.
