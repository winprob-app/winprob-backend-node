// Mapa de nombres distintos (de TheSportsDB o iSports) que son
// en realidad la misma liga real, hacia un nombre único para mostrar.
const leagueAliases = {
  "argentine division 1": "Primera División Argentina",
  "argentinian primera division": "Primera División Argentina",
  "la liga": "La Liga",
  "spanish la liga": "La Liga",
  "primera division": "La Liga",
  "bundesliga": "Bundesliga",
  "german bundesliga": "Bundesliga",
};

function normalize(name) {
  return String(name || "").toLowerCase().trim();
}

function getDisplayLeagueName(rawName) {
  const key = normalize(rawName);
  return leagueAliases[key] || rawName;
}

module.exports = { getDisplayLeagueName };