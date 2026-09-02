const express = require("express");
const router = express.Router();
const { supabase } = require("../index.");

const axios = require("axios");
const { getMatchesByDate } = require("../services/apiFootball");
const { getMatchesConverted } = require("../services/footballData");
const { getDisplayLeagueName } = require("../services/leagueAliases");
const { cacheTeamLogoFromUrl } = require("../services/logoStorage");

let cachedMatches = [];
let lastUpdate = 0;

router.get("/", async (req, res) => {

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

    
console.log("🌍 CONSULTANDO THESPORTSDB + iSPORTS");
console.log("📡 CONSULTANDO ISPORTS SIMULTÁNEAMENTE");


// ==========================
// FECHAS
// ==========================

const today = new Date();

console.log("Fecha actual servidor:", today);

const formatDate = (date) =>
  date.toISOString().split("T")[0];

// ==========================
// THESPORTSDB: ventana actual
// ==========================

const sportsDbDates = [];

for (let i = -7; i <= 7; i++) {
  const date = new Date(today);
  date.setDate(today.getDate() + i);

  sportsDbDates.push(formatDate(date));
}

// ==========================
// iSPORTS: solo hoy + mañana + pasado mañana
// ==========================

const apiFootballDates = [];

for (let i = 0; i <= 2; i++) {
  const date = new Date(today);
  date.setDate(today.getDate() + i);

  apiFootballDates.push(formatDate(date));
}

// ==========================
// THESPORTSDB
// ==========================

const sportsDbRequests = sportsDbDates.map((date) =>
  axios.get(
    `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&s=Soccer`
  )
);

// ==========================
// iSPORTS
// ==========================

const apiFootballRequests = apiFootballDates.map((date) =>
  getMatchesByDate(date)
);

// ==========================
// EJECUTAR LAS DOS APIS
// ==========================

// ==========================
// FOOTBALL-DATA: rango completo en una sola llamada
// ==========================

const footballDataFrom = formatDate(today);
const footballDataToDate = new Date(today);
footballDataToDate.setDate(today.getDate() + 10);
const footballDataTo = formatDate(footballDataToDate);

// ==========================
// EJECUTAR LAS TRES APIS
// ==========================

const [sportsDbResponses, isportsResponses, footballDataEvents] =
  await Promise.all([
    Promise.all(sportsDbRequests),
    Promise.all(apiFootballRequests),
    getMatchesConverted(footballDataFrom, footballDataTo),
  ]);

console.log(
  "📊 TheSportsDB:",
  sportsDbResponses.length,
  "consultas"
);

console.log(
  "📊 iSports:",
  isportsResponses.length,
  "consultas"
);

// ==========================
// PARTIDOS THESPORTSDB
// ==========================

let sportsDbEvents = [];

for (const response of sportsDbResponses) {
  sportsDbEvents.push(
    ...(response.data.events || [])
  );
}

// ==========================
// PARTIDOS iSPORTS
// ==========================

let isportsEvents = [];

for (const data of isportsResponses) {
  isportsEvents.push(...data);
}

console.log(
  "📊 PARTIDOS THESPORTSDB:",
  sportsDbEvents.length
);

console.log(
  "📊 PARTIDOS iSPORTS:",
  isportsEvents.length
);

// ==========================
// UNIR PARTIDOS DE LAS DOS APIS
// ==========================

let events = [];

console.log(
  "📊 EVENTOS THESPORTSDB CARGADOS:",
  events.length
);

console.log(
  "📊 EVENTOS iSPORTS PENDIENTES DE CONVERTIR:",
  isportsEvents.length
);


const filteredIsportsEvents = isportsEvents;

console.log(
  "📊 iSPORTS ANTES DEL FILTRO:",
  isportsEvents.length
);

console.log(
  "📊 iSPORTS DESPUÉS DEL FILTRO:",
  filteredIsportsEvents.length
);

console.log(
  "📋 DETALLE FILTRADO iSPORTS:",
  filteredIsportsEvents.slice(0, 156).map(event => ({
    leagueName: event?.strLeague,
    homeName: event?.strHomeTeam,
    awayName: event?.strAwayTeam,
    date: event?.strTimestamp || null
  }))
);

// ==========================
// API-FOOTBALL YA VIENE CONVERTIDO
// ==========================

const convertedIsportsEvents = filteredIsportsEvents;

console.log(
  "📊 iSPORTS CONVERTIDOS:",
  convertedIsportsEvents.length
);

// ==========================
// UNIR PARTIDOS
// ==========================

events.push(...sportsDbEvents);
events.push(...convertedIsportsEvents);
events.push(...footballDataEvents);

console.log(
  "📊 EVENTOS FOOTBALL-DATA:",
  footballDataEvents.length
);

console.log(
  "📊 EVENTOS THESPORTSDB:",
  sportsDbEvents.length
);

console.log(
  "📊 EVENTOS iSPORTS:",
  convertedIsportsEvents.length
);

console.log(
  "📊 TOTAL PARTIDOS DE LAS DOS APIS:",
  events.length
);

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

console.log("=== DIAGNÓSTICO DUPLICADOS iSPORTS vs THESPORTSDB ===");
console.log("📊 TheSportsDB antes de combinar:", sportsDbEvents.length);
console.log("📊 iSPORTS después del filtro:", filteredIsportsEvents.length);
console.log("📊 Total antes de eliminar duplicados:", events.length);

const uniqueEvents = [
  ...new Map(
    events.map(event => [event.idEvent, event])
  ).values()
];

console.log("📊 Total después de eliminar duplicados:", uniqueEvents.length);

const sportsDbIds = new Set(
  sportsDbEvents.map(event => Number(event.idEvent))
);

const isportsMatchedIds = filteredIsportsEvents
  .map(event => Number(event.idEvent))
  .filter(id => sportsDbIds.has(id));

console.log("📊 IDs de iSPORTS que coinciden con IDs de TheSportsDB:", isportsMatchedIds.length);

const matchedExamples = filteredIsportsEvents
  .filter(event => sportsDbIds.has(Number(event.idEvent)))
  .slice(0, 20)
  .map(event => ({
    league: event.strLeague,
    local: event.strHomeTeam,
    visitante: event.strAwayTeam,
    fecha: event.strTimestamp || null,
    idEvent: event.idEvent
  }));

console.log("📋 Ejemplos de coincidencias (máx 20):", JSON.stringify(matchedExamples, null, 2));

console.log("=== FIN DIAGNÓSTICO DUPLICADOS ===");

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
    name: getDisplayLeagueName(event.strLeague),
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

// ==========================
// GUARDAR EN SUPABASE
// ==========================

const matchesToSave = cachedMatches.map(match => ({
  id: match.fixture.id,

  league_id: match.league.id,
  league_name: match.league.name,

  fixture_date: match.fixture.date,
  status: match.fixture.status.short,

  home_team_id: match.teams.home.id,
  home_team_name: match.teams.home.name,

  away_team_id: match.teams.away.id,
  away_team_name: match.teams.away.name,

  home_score: match.goals.home,
  away_score: match.goals.away
}));

const { data, error } = await supabase
  .from("matches")
  .upsert(matchesToSave, {
    onConflict: "id"
  });

if (error) {
  console.log("❌ ERROR INSERTANDO:", error);
} else {
  console.log(
    `💾 ${matchesToSave.length} PARTIDOS GUARDADOS/ACTUALIZADOS`
  );
}

lastUpdate = now;

const uniqueTeams = Array.from(
  new Map(
    cachedMatches
      .flatMap((match) => [
        {
          teamId: match.teams?.home?.id,
          teamName: match.teams?.home?.name,
          logoUrl: match.teams?.home?.logo,
        },
        {
          teamId: match.teams?.away?.id,
          teamName: match.teams?.away?.name,
          logoUrl: match.teams?.away?.logo,
        },
      ])
      .filter((team) => team.teamId && team.teamName && team.logoUrl)
      .map((team) => [String(team.teamId), team])
  ).values()
);

console.log("🖼️ EQUIPOS ÚNICOS PARA GUARDAR LOGO:", uniqueTeams.length);
console.log("🖼️ EJEMPLO:", JSON.stringify(uniqueTeams.slice(0, 3), null, 2));

Promise.allSettled(
  uniqueTeams.map(async (team) => {
    try {
      await cacheTeamLogoFromUrl(team.teamId, team.teamName, team.logoUrl);
    } catch (error) {
      console.error("❌ Error saving team logo from matches:", error.message);
    }
  })
);

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

module.exports = router;