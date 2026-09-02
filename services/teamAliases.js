// Mapa de nombres de equipo distintos (según la fuente: TheSportsDB,
// football-data.org, openfootball) que son en realidad el mismo equipo,
// hacia un nombre único para guardar y mostrar.
const teamAliases = {
  // España
  "elche cf": "Elche",
  "levante ud": "Levante",
  "rcd espanyol": "Espanyol",
  "rcd espanyol de barcelona": "Espanyol",
  "villarreal cf": "Villarreal",
  "athletic club": "Athletic Bilbao",
  "deportivo alavés": "Alaves",
  "getafe cf": "Getafe",
  "málaga cf": "Malaga",
  "rayo vallecano de madrid": "Rayo Vallecano",
  "real betis balompié": "Real Betis",
  "real sociedad de fútbol": "Real Sociedad",
  "sevilla fc": "Sevilla",
  "valencia cf": "Valencia",

  // Alemania (Bundesliga)
  "bayern munchen": "FC Bayern München",
  "bayern münchen": "FC Bayern München",
  "fsv mainz 05": "1. FSV Mainz 05",
  "bayer leverkusen": "Bayer 04 Leverkusen",
  "union berlin": "1. FC Union Berlin",
  "1899 hoffenheim": "TSG 1899 Hoffenheim",
  "sv elversberg": "SV 07 Elversberg",

  // Brasil
  "atletico mineiro": "CA Mineiro",
  "atletico paranaense": "CA Paranaense",
  "bahia": "EC Bahia",
  "botafogo rj": "Botafogo FR",
  "bragantino": "RB Bragantino",
  "chapecoense sc": "Chapecoense AF",
  "corinthians paulista (sp)": "SC Corinthians Paulista",
  "coritiba pr": "Coritiba FBC",
  "cruzeiro": "Cruzeiro EC",
  "flamengo": "CR Flamengo",
  "fluminense rj": "Fluminense FC",
  "gremio (rs)": "Grêmio FBPA",
  "internacional rs": "SC Internacional",
  "mirassol": "Mirassol FC",
  "palmeiras": "SE Palmeiras",
  "remo belem (pa)": "Clube do Remo",
  "santos": "Santos FC",
  "sao paulo": "São Paulo FC",
  "vasco da gama": "CR Vasco da Gama",
  "vitoria ba": "EC Vitória",
};

function normalize(name) {
  return String(name || "").toLowerCase().trim();
}

function getDisplayTeamName(rawName) {
  const key = normalize(rawName);
  return teamAliases[key] || rawName;
}

module.exports = { getDisplayTeamName };