require("dotenv").config();
console.log(process.env);

console.log("========== INDEX NUEVO ==========");
console.log("SOY EL INDEX LOCAL DE DUVAN");

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const fs = require("fs-extra");
const path = require("path");

const app = express();
app.use(cors());

let cachedMatches = [];
let lastUpdate = null;

const FOOTBALL_DATA_KEY =
  process.env.FOOTBALL_DATA_KEY;

  const LOGOS_FOLDER = path.join(
  __dirname,
  "logos",
  "teams"
);

fs.ensureDirSync(LOGOS_FOLDER);

app.get("/matches", async (req, res) => {

  try {

    const now = Date.now();

    if (
      cachedMatches.length > 0 &&
      lastUpdate &&
      now - lastUpdate < 5 * 60 * 1000
    ) {

      console.log("📦 CACHE UTILIZADO");

      return res.json(cachedMatches);
    }

    
console.log("🌍 CONSULTANDO THESPORTSDB");

// ==========================
// FECHAS
// ==========================

const today = new Date();

console.log("Fecha actual servidor:", today);

const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(today.getDate() - 7);

const sevenDaysLater = new Date(today);
sevenDaysLater.setDate(today.getDate() + 7);

const formatDate = (date) =>
  date.toISOString().split("T")[0];

// ==========================
// CONSULTAS EN PARALELO
// ==========================

const requests = [];

for (let i = -7; i <= 7; i++) {

  const date = new Date(today);

  date.setDate(today.getDate() + i);

  requests.push(

    axios.get(
      `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${formatDate(date)}&s=Soccer`
    )

  );

}

const responses = await Promise.all(requests);

console.log("========== RESPUESTAS ==========");

responses.forEach((response, index) => {

  const cantidad =
      response.data.events
      ? response.data.events.length
      : 0;

  console.log(
    `${formatDate(new Date(today.getTime() + (index - 7) * 86400000))} -> ${cantidad}`
  );

});

console.log("========== RESPUESTAS ==========");

responses.forEach((response, index) => {

  const cantidad = response.data.events
      ? response.data.events.length
      : 0;

  console.log(
    `Día ${index - 7}: ${cantidad} partidos`
  );

});

let events = [];

// ==========================
// UNIR TODOS LOS PARTIDOS
// ==========================

for (const response of responses) {

  events.push(
    ...(response.data.events || [])
  );

}

// ==========================
// ELIMINAR DUPLICADOS
// ==========================

events = [
  ...new Map(
    events.map(event => [event.idEvent, event])
  ).values()
];

// ==========================
// ORDENAR POR FECHA
// ==========================

events.sort((a, b) =>
  new Date(a.strTimestamp) -
  new Date(b.strTimestamp)
);

console.log("PARTIDOS ENCONTRADOS:", events.length);

events.forEach(event => {

  console.log(
    event.strTimestamp,
    "-",
    event.strLeague,
    "-",
    event.strHomeTeam,
    "vs",
    event.strAwayTeam
  );

});

cachedMatches = events.map(event => ({

  fixture: {
  id: parseInt(event.idEvent),
    date: event.strTimestamp,
    status: {
      short: event.strStatus
    }
  },

  league: {
  id: parseInt(event.idLeague),
    name: event.strLeague,
    logo: event.strLeagueBadge
  },

  teams: {
  home: {
    id: parseInt(event.idHomeTeam),
    name: event.strHomeTeam,
    logo: event.strHomeTeamBadge
  },
  away: {
    id: parseInt(event.idAwayTeam),
    name: event.strAwayTeam,
    logo: event.strAwayTeamBadge
  }
},

  goals: {
  home: event.intHomeScore == null
      ? null
      : parseInt(event.intHomeScore),

  away: event.intAwayScore == null
      ? null
      : parseInt(event.intAwayScore)
}

}));

lastUpdate = now;

res.json(cachedMatches);

  } catch (error) {

    console.log(error.message);

    if (cachedMatches.length > 0) {

      console.log("📦 DEVOLVIENDO CACHE");

      return res.json(cachedMatches);
    }

    res.status(500).json({
      error: "Error obteniendo partidos"
    });
  }
});

const sharp = require("sharp");

const teamLogoMap = {
  770: "england",
  762: "argentina",
  760: "spain",
  773: "france",
  769: "brazil",
  758: "germany",
  760: "spain",
  765: "netherlands",
  764: "belgium",
  563: "real-madrid",
  81: "barcelona",
  64: "liverpool",
  65: "manchester-city",
  66: "manchester-united"
};

app.get("/logo", async (req, res) => {

  console.log("======== NUEVO LOGO ========");

console.log("TEAM ID:", req.query.teamId);

console.log("URL:", req.query.url);

  try {

    const teamId = req.query.teamId;
let imageUrl = req.query.url;

if (teamId && teamLogoMap[teamId]) {
  imageUrl = `https://football-logos.cc/logos/${teamLogoMap[teamId]}.png`;
}

    if (!imageUrl) {
      return res.status(400).send("URL requerida");
    }

    const fileName = path.basename(imageUrl).replace(".svg", ".png");

const localPath = path.join(
  LOGOS_FOLDER,
  fileName,
);

// ¿Ya existe el escudo?
if (await fs.pathExists(localPath)) {

  console.log("📦 Logo desde caché:", fileName);

  return res.sendFile(localPath);

}

    const response = await axios.get(
      imageUrl,
      {
        responseType: "arraybuffer"
      }
    );

    const contentType =
      response.headers["content-type"] || "";

    // Si ya es PNG simplemente lo enviamos
    if (contentType.includes("png")) {

  await fs.writeFile(localPath, response.data);

  console.log("💾 Logo guardado:", fileName);

  return res.sendFile(localPath);

}

    // Si es SVG lo convertimos automáticamente

    if (contentType.includes("svg")) {

  const png = await sharp(response.data)
    .png()
    .toBuffer();

  await fs.writeFile(localPath, png);

  console.log("💾 Logo convertido:", fileName);

  return res.sendFile(localPath);

}

    // Cualquier otro formato

    res.set("Content-Type", contentType);

    res.send(response.data);

  } catch (error) {

    console.log("ERROR LOGO:", error.message);

    res.status(500).send("Error cargando imagen");

  }

});

const PORT = process.env.PORT || 3000;

let matchesCache = [];

let lastMatchesUpdate = 0;

const MATCH_CACHE_TIME = 5 * 60 * 1000;

let headToHeadCache = {};

const HEAD_CACHE_TIME = 30 * 60 * 1000;

// ==========================
// CACHE TEAM STATS
// ==========================

const teamStatsCache = {};

const TEAM_STATS_CACHE_TIME = 5 * 60 * 1000;

// ==========================
// PETICIONES TEAM STATS EN CURSO
// ==========================

const pendingTeamStats = {};

/* app.get("/test-football-data", async (req, res) => {

  if (!FOOTBALL_DATA_KEY) {

    return res.status(500).json({
      error: "No existe FOOTBALL_DATA_KEY"
    });

  }

  res.json({
    ok: true,
    message: "Football-Data configurada correctamente"
  });

}); */

/* app.get("/matches-live", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.football-data.org/v4/matches",
      {
        headers: {
          "X-Auth-Token": FOOTBALL_DATA_KEY
        }
      }
    );

    const liveMatches = response.data.matches.filter(match =>
      [
        "IN_PLAY",
        "PAUSED"
      ].includes(match.status)
    );

    res.json(liveMatches);

  } catch (error) {

    console.log(error.response?.data || error.message);

    res.status(500).json({
      error: "Error partidos en vivo"
    });

  }

}); */

/* async function getTeamFormCached(teamId) {

  const cacheKey = "form_" + teamId;

  if (
    teamStatsCache[cacheKey] &&
    (Date.now() - teamStatsCache[cacheKey].updated) < TEAM_STATS_CACHE_TIME
  ) {
    return teamStatsCache[cacheKey].data;
  }

  const response = await axios.get(
    `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED`,
    {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_KEY
      }
    }
  );

  const form =
response.data.matches.slice(0,5);

  teamStatsCache[cacheKey] = {

    updated: Date.now(),

    data: form

  };

  return form;

} */

/* async function getHeadToHeadCached(homeId, awayId) {

  const cacheKey = `${homeId}_${awayId}`;

  if (
    headToHeadCache[cacheKey] &&
    (Date.now() - headToHeadCache[cacheKey].updated) < HEAD_CACHE_TIME
  ) {
    return headToHeadCache[cacheKey].data;
  }

  const response = await axios.get(
    `https://api.football-data.org/v4/teams/${homeId}/matches?status=FINISHED`,
    {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_KEY
      }
    }
  );

  const matches = response.data.matches
    .filter(match =>

      (match.homeTeam.id == homeId &&
       match.awayTeam.id == awayId)

      ||

      (match.homeTeam.id == awayId &&
       match.awayTeam.id == homeId)

    )
    .slice(0, 5);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  matches.forEach(match => {

    const hg = match.score.fullTime.home;
    const ag = match.score.fullTime.away;

    if (hg == ag) {

      draws++;

    } else {

      if (match.homeTeam.id == homeId) {

        if (hg > ag)
          homeWins++;
        else
          awayWins++;

      } else {

        if (ag > hg)
          homeWins++;
        else
          awayWins++;

      }

    }

  });

  const stats = {

    homeWins,

    awayWins,

    draws,

    matches: matches.length

  };

  headToHeadCache[cacheKey] = {

    updated: Date.now(),

    data: stats

  };

  return stats;

} */

app.get("/matches-v2", async (req, res) => {

  console.log("===== INICIO MATCHES V2 =====");

  try {

    const now = Date.now();

    // ==========================
    // CACHE (5 minutos)
    // ==========================

    if (
      matchesCache.length > 0 &&
      (now - lastMatchesUpdate) < MATCH_CACHE_TIME
    ) {

      console.log("📦 Partidos desde CACHE");

      return res.json(matchesCache);

    }

    // ==========================
    // FECHAS
    // ==========================

    // Fecha actual del servidor
const today = new Date();

const from = today.toISOString().split("T")[0];

const future = new Date(today);

// Football-Data permite máximo 10 días
future.setDate(today.getDate() + 9);

const to = future.toISOString().split("T")[0];

console.log("FROM:", from);
console.log("TO:", to);

    // ==========================
    // CONSULTAS
    // ==========================

  console.log("Consultando Football-Data...");

    let scheduledResponse;
let liveResponse;

try {

console.log("FROM:", from);
console.log("TO:", to);

console.log("API KEY:", FOOTBALL_DATA_KEY?.substring(0, 8));

  scheduledResponse = await axios.get(
  `https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`,
  {
    headers: {
      "X-Auth-Token": FOOTBALL_DATA_KEY
    }
  }
);

  console.log("✅ Scheduled OK");

  console.log(scheduledResponse.data);

} catch(err){

  console.log("❌ Scheduled ERROR");

  console.log(err.response?.status);

  console.log(err.response?.data);

}

// Ya no usamos Football-Data.
// Los partidos vienen de TheSportsDB.


    // ==========================
    // UNIR PARTIDOS
    // ==========================

if (!scheduledResponse && !liveResponse) {

  throw new Error(
    "Football-Data no respondió porque se alcanzó el límite de peticiones."
  );

}

    const allMatches = [

    ...(liveResponse?.data?.matches || []),

    ...(scheduledResponse?.data?.matches || [])

];

    console.log(
  "ALL MATCHES:",
  allMatches.length
);

    // ==========================
    // ELIMINAR DUPLICADOS
    // ==========================

    const uniqueMatches = [

      ...new Map(
        allMatches.map(match => [match.id, match])
      ).values()

    ];

    // ==========================
    // LIGAS PERMITIDAS
    // ==========================

    const allowedCompetitions = [
  "PL",      // Premier League
  "PD",      // LaLiga
  "SA",      // Serie A
  "BL1",     // Bundesliga
  "FL1",     // Ligue 1
  "DED",     // Eredivisie
  "PPL",     // Primeira Liga
  "ELC",     // Championship
  "CLI",     // Libertadores
  "BSA"      // Brasileirão
];

console.log(
  uniqueMatches.map(m => ({
    competition: m.competition.code,
    home: m.homeTeam?.name,
    away: m.awayTeam?.name,
    status: m.status
  }))
);

    const filteredMatches = uniqueMatches.filter(match =>

      allowedCompetitions.includes(
        match.competition.code
      )

    );

    const validMatches = filteredMatches.filter(match =>

      match.homeTeam &&
      match.awayTeam &&
      match.homeTeam.id &&
      match.awayTeam.id &&
      match.homeTeam.name &&
      match.awayTeam.name

    );

    
/* async function getTeamStatsFromApi(teamId) {

  if (
    teamStatsCache[teamId] &&
    (Date.now() - teamStatsCache[teamId].updated) < TEAM_STATS_CACHE_TIME
  ) {
    return teamStatsCache[teamId].data;
  }

  const response = await axios.get(
    `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=5`,
    {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_KEY
      }
    }
  );

  const matches = (response.data.matches || []).slice(0, 5);

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsFor = 0;
  let goalsAgainst = 0;

  matches.forEach(match => {

    const isHome = match.homeTeam.id == teamId;

    const gf = isHome
      ? match.score.fullTime.home
      : match.score.fullTime.away;

    const ga = isHome
      ? match.score.fullTime.away
      : match.score.fullTime.home;

    goalsFor += gf ?? 0;
    goalsAgainst += ga ?? 0;

    if (gf > ga) wins++;
    else if (gf == ga) draws++;
    else losses++;

  });

  const stats = {

    wins,
    draws,
    losses,

    goalsForAverage:
      matches.length == 0
        ? 0
        : goalsFor / matches.length,

    goalsAgainstAverage:
      matches.length == 0
        ? 0
        : goalsAgainst / matches.length,

  };

  teamStatsCache[teamId] = {

    updated: Date.now(),
    data: stats

  };

  return stats;

} */

    // ==========================
    // MAPEO
    // ==========================

console.log("ANTES DEL PROMISE ALL");

// ==========================
// PRECARGAR STATS DE EQUIPOS
// ==========================

    const matches = await Promise.all(

  validMatches.map(async (match) => {

// ==========================
// ESTADÍSTICAS DEL EQUIPO
// ==========================

const homeStats = {
  wins: 0,
  draws: 0,
  losses: 0,
  goalsForAverage: 0,
  goalsAgainstAverage: 0
};

const awayStats = {
  wins: 0,
  draws: 0,
  losses: 0,
  goalsForAverage: 0,
  goalsAgainstAverage: 0
};

    const fixture = {
      id: match.id,
      date: match.utcDate,
      status: {
        short:
          match.status === "TIMED"
            ? "NS"
            : match.status === "SCHEDULED"
            ? "NS"
            : match.status === "IN_PLAY"
            ? "1H"
            : match.status === "PAUSED"
            ? "HT"
            : match.status === "FINISHED"
            ? "FT"
            : match.status
      }
    };

    const league = {
      id: match.competition.id,
      name: match.competition.name,
      logo: match.competition.emblem
    };

    const teams = {

      home: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        logo:
          match.competition.code === "WC"
            ? `https://images.football-logos.com/${match.homeTeam.id}.png`
            : match.homeTeam.crest
      },

      away: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        logo:
          match.competition.code === "WC"
            ? `https://images.football-logos.com/${match.awayTeam.id}.png`
            : match.awayTeam.crest
      }

    };

    const goals = {
      home: match.score.fullTime.home,
      away: match.score.fullTime.away
    };

    
console.log(
  "Procesando:",
  match.homeTeam.name,
  "vs",
  match.awayTeam.name
);

return {

  fixture,
  league,
  teams,
  goals,

  stats: {},

form: {},

  headToHead: {},

};

  })

);

    // ==========================
    // GUARDAR CACHE
    // ==========================

    matchesCache = matches;

    lastMatchesUpdate = Date.now();

    console.log("🌍 Football-Data actualizado");

    console.log("📦 Partidos guardados:", matches.length);

    res.json(matchesCache);

  } 
  
   catch (error) {

  console.log("ERROR MATCHES V2");

  console.log(error.response?.status);

  if (matchesCache.length > 0) {

    console.log("📦 DEVOLVIENDO CACHE POR ERROR");

    return res.json(matchesCache);

  }

  res.status(500).json({
    error: error.message
  });

}

});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});