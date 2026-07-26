/* Modèles calisthénie prêts à verser au catalogue du club (13 séances + 4
   programmes), bundlés dans l'app. Contenu ORIGINAL du jeu de données
   calisthénie (cf. datasets/calisthenie_complet.json, mentions_legales :
   « modèles de séances = contenus originaux »). Import CLUB-LOCAL uniquement
   (usage club, jamais partagé inter-clubs tant que la licence des sources
   compilées n'est pas confirmée) : chaque entrée devient une section-type
   candidate (scope='catalog', status='draft') dédupliquée par `id` stable.

   - séances   → sections d'exercices (prescription = séries × répétitions/temps) ;
   - programmes → note narrative (semaine type jour → séance).
   Attribution conservée via `source`. */

export const CALISTHENICS_CATALOG_SOURCE = "Modèles calisthénie (usage club)";

export const CALISTHENICS_CATALOG = {
  "seances": [
    {
      "id": "cal:full_body_A",
      "name": "Full body A",
      "kind": "strength",
      "objective": "Construire les bases (débutant)",
      "durationMin": 40,
      "section": {
        "type": "exercises",
        "title": "Full body A",
        "subtitle": "Construire les bases (débutant)",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Tractions pronation",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 3-8 (ou négatives)",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Pompes",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "4× 8-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Squats",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 15-20",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Dips sur chaise / banc",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 8-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Rowing australien",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Hollow body hold",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 20-40 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "7",
            "name": "Gainage ventral",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 30-60 s",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:full_body_B",
      "name": "Full body B",
      "kind": "strength",
      "objective": "Construire les bases (débutant)",
      "durationMin": 40,
      "section": {
        "type": "exercises",
        "title": "Full body B",
        "subtitle": "Construire les bases (débutant)",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Tractions supination",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 3-8",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Pompes piquées",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 6-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Squats bulgares",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 8-12 / jambe",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Rowing australien aux anneaux",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Pont fessier",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 12-20",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Relevés de genoux suspendu",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 8-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "7",
            "name": "Gainage latéral",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 30 s / côté",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:push",
      "name": "Push — pectoraux, épaules, triceps",
      "kind": "strength",
      "objective": "Force en poussée",
      "durationMin": 45,
      "section": {
        "type": "exercises",
        "title": "Push — pectoraux, épaules, triceps",
        "subtitle": "Force en poussée",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "HSPU au mur",
            "tempo": "",
            "rest": "150s",
            "weeks": [
              {
                "text": "4× 3-8",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Dips aux barres",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 6-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Pompes archer",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 6-10 / côté",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Pompes diamant",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 8-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Extension triceps en planche",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Tenue basse de pompe",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "2× 20-30 s",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:pull",
      "name": "Pull — dos, biceps, arrière d'épaules",
      "kind": "strength",
      "objective": "Force en tirage",
      "durationMin": 45,
      "section": {
        "type": "exercises",
        "title": "Pull — dos, biceps, arrière d'épaules",
        "subtitle": "Force en tirage",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Tractions pronation",
            "tempo": "",
            "rest": "150s",
            "weeks": [
              {
                "text": "4× 4-10",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Rowing australien",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "4× 8-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Tractions supination",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "3× 4-10",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Haussements d'épaules suspendu",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Curl au poids du corps",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 6-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Superman pull",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 12-15",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:jambes",
      "name": "Jambes & fessiers",
      "kind": "strength",
      "objective": "Force et équilibre du bas du corps",
      "durationMin": 40,
      "section": {
        "type": "exercises",
        "title": "Jambes & fessiers",
        "subtitle": "Force et équilibre du bas du corps",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Pistol squat assisté",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 6-10 / jambe",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Squats bulgares",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 8-12 / jambe",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Fentes croisées (curtsy)",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 10-12 / jambe",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Pont fessier unilatéral",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 12-15 / jambe",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Sissy squats",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Extensions mollets",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 15-25",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:haut_du_corps",
      "name": "Haut du corps (upper)",
      "kind": "strength",
      "objective": "Volume global haut du corps",
      "durationMin": 50,
      "section": {
        "type": "exercises",
        "title": "Haut du corps (upper)",
        "subtitle": "Volume global haut du corps",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Tractions pronation",
            "tempo": "",
            "rest": "150s",
            "weeks": [
              {
                "text": "4× 4-10",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Dips aux barres",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 6-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Rowing australien",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 10-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Pompes",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 12-20",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Pompes piquées",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 6-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Relevés de genoux suspendu",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 10-15",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:bas_du_corps",
      "name": "Bas du corps (lower)",
      "kind": "strength",
      "objective": "Volume global bas du corps",
      "durationMin": 40,
      "section": {
        "type": "exercises",
        "title": "Bas du corps (lower)",
        "subtitle": "Volume global bas du corps",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Squats sautés",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "3× 10-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Fentes arrière",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 10 / jambe",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Frog pumps",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 15-20",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Sissy squats",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Chaise au mur sur pointes",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 30-45 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Donkey calf raises",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 15-20",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:skill_bras_tendus",
      "name": "Skill — bras tendus",
      "kind": "strength",
      "objective": "Travail des statiques (front/back lever, ATR, planche)",
      "durationMin": 45,
      "section": {
        "type": "exercises",
        "title": "Skill — bras tendus",
        "subtitle": "Travail des statiques (front/back lever, ATR, planche)",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "ATR dos au mur",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "5× 20-45 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Front lever groupé",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "5× 8-20 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Back lever groupé",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 10-20 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Elbow planche",
            "tempo": "",
            "rest": "90s",
            "weeks": [
              {
                "text": "4× 10-20 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Hollow body hold",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 30-45 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Superman hold",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 20-30 s",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:force_bras_flechis",
      "name": "Force — bras fléchis",
      "kind": "strength",
      "objective": "Force dynamique et progression vers muscle up / HSPU",
      "durationMin": 45,
      "section": {
        "type": "exercises",
        "title": "Force — bras fléchis",
        "subtitle": "Force dynamique et progression vers muscle up / HSPU",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Tractions explosives",
            "tempo": "",
            "rest": "150s",
            "weeks": [
              {
                "text": "5× 3-5",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "HSPU au mur",
            "tempo": "",
            "rest": "150s",
            "weeks": [
              {
                "text": "4× 3-8",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Dips aux barres",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 6-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Tractions pronation",
            "tempo": "",
            "rest": "120s",
            "weeks": [
              {
                "text": "4× 4-10",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Pompes",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 12-20",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Squats",
            "tempo": "",
            "rest": "75s",
            "weeks": [
              {
                "text": "3× 15-20",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:circuit_core",
      "name": "Circuit core",
      "kind": "cardio",
      "objective": "Gainage dynamique + statique",
      "durationMin": 25,
      "section": {
        "type": "exercises",
        "title": "Circuit core",
        "subtitle": "Gainage dynamique + statique",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Dragon fly",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 6-8",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Essuie-glaces",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 8 / côté",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "V-ups",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 8-12",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "L-sit suspendu",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× max",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Hollow body hold",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× max",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:circuit_cardio",
      "name": "Circuit cardio / dépense",
      "kind": "cardio",
      "objective": "Endurance et dépense énergétique",
      "durationMin": 20,
      "section": {
        "type": "exercises",
        "title": "Circuit cardio / dépense",
        "subtitle": "Endurance et dépense énergétique",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Jumping jacks",
            "tempo": "",
            "rest": "15s",
            "weeks": [
              {
                "text": "4× 30 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Burpees",
            "tempo": "",
            "rest": "15s",
            "weeks": [
              {
                "text": "4× 8-10",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Mountain climbers",
            "tempo": "",
            "rest": "15s",
            "weeks": [
              {
                "text": "4× 30 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Montées de genoux",
            "tempo": "",
            "rest": "15s",
            "weeks": [
              {
                "text": "4× 20 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Squats sautés",
            "tempo": "",
            "rest": "15s",
            "weeks": [
              {
                "text": "4× 10-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Touches d'épaules en planche",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "4× 20",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:mobilite",
      "name": "Souplesse & mobilité",
      "kind": "mobility",
      "objective": "Amplitude articulaire et longueur musculaire",
      "durationMin": 25,
      "section": {
        "type": "exercises",
        "title": "Souplesse & mobilité",
        "subtitle": "Amplitude articulaire et longueur musculaire",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "Mobilité d'épaules (dislocates)",
            "tempo": "",
            "rest": "30s",
            "weeks": [
              {
                "text": "2× 10-15",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Mobilité de poignets",
            "tempo": "",
            "rest": "",
            "weeks": [
              {
                "text": "1× 2-3 min",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "3",
            "name": "Chien tête en bas",
            "tempo": "",
            "rest": "20s",
            "weeks": [
              {
                "text": "2× 45 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "4",
            "name": "Flexion avant debout",
            "tempo": "",
            "rest": "20s",
            "weeks": [
              {
                "text": "2× 60 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "5",
            "name": "Pont / extension dorsale",
            "tempo": "",
            "rest": "45s",
            "weeks": [
              {
                "text": "3× 30 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "6",
            "name": "Étirement du pigeon",
            "tempo": "",
            "rest": "20s",
            "weeks": [
              {
                "text": "2× 60 s / côté",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "7",
            "name": "Étirement papillon",
            "tempo": "",
            "rest": "20s",
            "weeks": [
              {
                "text": "2× 60 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "8",
            "name": "Posture de l'enfant",
            "tempo": "",
            "rest": "",
            "weeks": [
              {
                "text": "1× 60 s",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    },
    {
      "id": "cal:pratique_quotidienne",
      "name": "Pratique quotidienne (greasing the groove)",
      "kind": "strength",
      "objective": "Fréquence sans fatigue",
      "durationMin": 10,
      "section": {
        "type": "exercises",
        "title": "Pratique quotidienne (greasing the groove)",
        "subtitle": "Fréquence sans fatigue",
        "weekLabels": [
          "Prescription"
        ],
        "weekAccents": [
          "c"
        ],
        "rows": [
          {
            "block": "1",
            "name": "ATR dos au mur",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 30 s",
                "peak": false
              }
            ],
            "note": ""
          },
          {
            "block": "2",
            "name": "Hollow body hold",
            "tempo": "",
            "rest": "60s",
            "weeks": [
              {
                "text": "3× 30 s",
                "peak": false
              }
            ],
            "note": ""
          }
        ]
      }
    }
  ],
  "programmes": [
    {
      "id": "cal:debutant_3j",
      "name": "Débutant — 3 jours full body",
      "kind": "note",
      "objective": "",
      "durationMin": null,
      "section": {
        "type": "narrative",
        "title": "Débutant — 3 jours full body",
        "subtitle": "8 semaines · Aucun prérequis",
        "body": "Cycle de 8 semaines.\nPublic : Aucun prérequis\n\nSemaine type :\n- Jour 1 : Full body A\n- Jour 2 : Repos\n- Jour 3 : Full body B\n- Jour 4 : Souplesse & mobilité\n- Jour 5 : Full body A\n- Jour 6 : Repos\n- Jour 7 : Repos"
      }
    },
    {
      "id": "cal:ppl_5j",
      "name": "Push / Pull / Jambes",
      "kind": "note",
      "objective": "",
      "durationMin": null,
      "section": {
        "type": "narrative",
        "title": "Push / Pull / Jambes",
        "subtitle": "8 semaines · Sait faire 5 tractions et 15 pompes",
        "body": "Cycle de 8 semaines.\nPublic : Sait faire 5 tractions et 15 pompes\n\nSemaine type :\n- Jour 1 : Push — pectoraux, épaules, triceps\n- Jour 2 : Pull — dos, biceps, arrière d'épaules\n- Jour 3 : Jambes & fessiers\n- Jour 4 : Circuit core\n- Jour 5 : Souplesse & mobilité\n- Jour 6 : Circuit cardio / dépense\n- Jour 7 : Repos"
      }
    },
    {
      "id": "cal:upper_lower_5j",
      "name": "Haut / Bas",
      "kind": "note",
      "objective": "",
      "durationMin": null,
      "section": {
        "type": "narrative",
        "title": "Haut / Bas",
        "subtitle": "8 semaines · Intermédiaire",
        "body": "Cycle de 8 semaines.\nPublic : Intermédiaire\n\nSemaine type :\n- Jour 1 : Haut du corps (upper)\n- Jour 2 : Bas du corps (lower)\n- Jour 3 : Haut du corps (upper)\n- Jour 4 : Bas du corps (lower)\n- Jour 5 : Haut du corps (upper)\n- Jour 6 : Circuit cardio / dépense\n- Jour 7 : Repos"
      }
    },
    {
      "id": "cal:skill_force_4j",
      "name": "Skill / Force en alternance",
      "kind": "note",
      "objective": "",
      "durationMin": null,
      "section": {
        "type": "narrative",
        "title": "Skill / Force en alternance",
        "subtitle": "12 semaines · Objectif skills (ATR, front lever, muscle up)",
        "body": "Cycle de 12 semaines.\nPublic : Objectif skills (ATR, front lever, muscle up)\n\nSemaine type :\n- Jour 1 : Skill — bras tendus\n- Jour 2 : Souplesse & mobilité\n- Jour 3 : Force — bras fléchis\n- Jour 4 : Souplesse & mobilité\n- Jour 5 : Skill — bras tendus\n- Jour 6 : Souplesse & mobilité\n- Jour 7 : Force — bras fléchis"
      }
    }
  ]
};

// Aplatit séances + programmes en une liste de candidats homogènes.
export function calisthenicsCandidates() {
  const { seances = [], programmes = [] } = CALISTHENICS_CATALOG;
  return [...seances, ...programmes];
}
