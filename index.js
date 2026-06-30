const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

let cachedMatches = [];
let lastUpdate = null;

const FOOTBALL_DATA_KEY =
  process.env.FOOTBALL_DATA_KEY;

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

const today = new Date()
  .toISOString()
  .split("T")[0];

const response = await axios.get(
  `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${today}&s=Soccer`
);

const events = response.data.events || [];

events.sort((a, b) =>
  new Date(a.strTimestamp) -
  new Date(b.strTimestamp)
);

cachedMatches = events.map(event => ({

  fixture: {
    id: event.idEvent,
    date: event.strTimestamp,
    status: {
      short: event.strStatus
    }
  },

  league: {
    id: event.idLeague,
    name: event.strLeague,
    logo: event.strLeagueBadge
  },

  teams: {
    home: {
      id: event.idHomeTeam,
      name: event.strHomeTeam,
      logo: event.strHomeTeamBadge
    },
    away: {
      id: event.idAwayTeam,
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

app.get("/logo", async (req, res) => {
  try {

    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).send("URL requerida");
    }

    const response = await axios.get(
      imageUrl,
      {
        responseType: "arraybuffer"
      }
    );

    res.set(
      "Content-Type",
      response.headers["content-type"]
    );

    res.send(response.data);

  } catch (error) {

    console.log(
      "ERROR LOGO:",
      error.message
    );

    res.status(500).send("Error cargando imagen");
  }
});

const PORT = process.env.PORT || 3000;

app.get("/test-football-data", async (req, res) => {

  if (!FOOTBALL_DATA_KEY) {

    return res.status(500).json({
      error: "No existe FOOTBALL_DATA_KEY"
    });

  }

  res.json({
    ok: true,
    message: "Football-Data configurada correctamente"
  });

});

app.get("/matches-v2", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.football-data.org/v4/matches",
      {
        headers: {
          "X-Auth-Token": FOOTBALL_DATA_KEY
        }
      }
    );

    const matches = response.data.matches.map(match => ({

  fixture: {
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
  },

  league: {
    id: match.competition.id,
    name: match.competition.name,
    logo: match.competition.emblem
  },

  teams: {

    home: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      logo: match.homeTeam.crest
    },

    away: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      logo: match.awayTeam.crest
    }

  },

  goals: {

    home: match.score.fullTime.home,

    away: match.score.fullTime.away

  }

}));

res.json(matches);

  } catch (error) {

    console.log(
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Error Football-Data"
    });

  }

});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});