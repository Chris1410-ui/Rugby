/* Veille scientifique — données de référence (rugby). Porté du prototype. */

export const BIBLIO = {
  rugby: [
    { y: 2023, a: "Peeters, Piscione et al. (FFR)", t: "Physical characteristics of young French elite rugby players (1 423 joueurs)", j: "PLOS One", q: "https://scholar.google.com/scholar?q=Physical+characteristics+young+French+elite+rugby+players+Peeters+Piscione" },
    { y: 2018, a: "Lacome, Carling, Hager, Dine, Piscione", t: "Workload, fatigue, and muscle damage in a U20 rugby union team", j: "Int J Sports Physiol Perform 13(8)", q: "https://scholar.google.com/scholar?q=Workload+fatigue+muscle+damage+U20+rugby+Lacome" },
    { y: 2017, a: "Lacome, Piscione, Hager, Carling", t: "Fluctuations in running and skill-related performance in elite rugby union match-play", j: "Eur J Sport Sci 17(2)", q: "https://scholar.google.com/scholar?q=Fluctuations+running+skill+rugby+match+Lacome" },
    { y: 2017, a: "Carling, Lacome, Flanagan, O'Doherty, Piscione", t: "Exposure time, running and skill-related performance in international U20", j: "PLOS One 12(11)", q: "https://scholar.google.com/scholar?q=Exposure+time+running+skill+international+U20+Carling" },
    { y: 2016, a: "Read, Darrall-Jones, Till, Jones et al.", t: "Movement Demands of Elite U20 and Senior International Rugby Union", j: "PLOS One", q: "https://scholar.google.com/scholar?q=Movement+Demands+Elite+U20+Senior+International+Rugby+Read" },
    { y: 2014, a: "Lacome, Piscione, Hager, Bourdin", t: "A new approach to quantifying physical demand in rugby union", j: "J Sports Sci 32(3)", q: "https://scholar.google.com/scholar?q=new+approach+quantifying+physical+demand+rugby+Lacome" },
  ],
};

export const VEILLE_THEMES = [
  { t: "Charge & ACWR", d: "Quantification de la charge interne/externe, ratio aigu:chronique, monotonie.", refs: ["rugby:0", "rugby:1"] },
  { t: "Demandes de match (GPS)", d: "Distances, haute vitesse, accélérations par poste et niveau.", refs: ["rugby:4", "rugby:5"] },
  { t: "Prévention des blessures", d: "Nordic, asymétries ischio-jambiers, screening.", refs: ["rugby:0", "rugby:3"] },
  { t: "Testing & condition", d: "Profils physiques des jeunes élites, batterie de tests.", refs: ["rugby:2", "rugby:3"] },
];

export const getRef = (id) => {
  const [sp, i] = id.split(":");
  return BIBLIO[sp]?.[+i];
};
