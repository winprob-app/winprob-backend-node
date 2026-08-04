const express = require("express");
const router = express.Router();

const axios = require("axios");

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

module.exports = router;