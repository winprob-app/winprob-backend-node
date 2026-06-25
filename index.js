const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

let cachedMatches = [];
let lastUpdate = null;

const API_KEY = process.env.API_FOOTBALL_KEY;

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

app.get("/team/:id", async (req, res) => {
  try {

    const teamId = req.params.id;

    const response = await axios.get(
      "https://v3.football.api-sports.io/teams",
      {
        headers: {
          "x-apisports-key": API_KEY
        },
        params: {
          id: teamId
        }
      }
    );

    res.json(response.data.response);

  } catch (error) {

    console.log(error.message);

    res.status(500).json({
      error: "Error obteniendo equipo"
    });

  }
});

app.get("/team-form/:id", async (req, res) => {

  try {

    const teamId = req.params.id;

    const response = await axios.get(
      "https://v3.football.api-sports.io/fixtures",
      {
        headers: {
          "x-apisports-key": API_KEY
        },
        params: {
          team: teamId,
          last: 5
        }
      }
    );

    res.json(response.data.response);

  } catch (error) {

    console.log("ERROR TEAM FORM:", error.message);

    res.status(500).json({
      error: "Error obteniendo forma del equipo"
    });

  }

});

app.get("/team-stats/:league/:team", async (req, res) => {
  try {

    const league = req.params.league;
    const team = req.params.team;

    console.log("LEAGUE:", league);
    console.log("TEAM:", team);

    const response = await axios.get(
      "https://v3.football.api-sports.io/teams/statistics",
      {
        headers: {
          "x-apisports-key": API_KEY
        },
        params: {
          league: league,
          season: 2024,
          team: team
        }
      }
    );

console.log(
  JSON.stringify(
    response.data,
    null,
    2
  )
);

    res.json(response.data.response);

  } catch (error) {

    console.log("ERROR:", error.response?.data);
    console.log("MESSAGE:", error.message);

    res.status(500).json({
      error: "Error obteniendo estadísticas"
    });

  }
});

app.get("/team-last-matches/:id", async (req, res) => {
  try {

    const teamId = req.params.id;

    const response = await axios.get(
      "https://v3.football.api-sports.io/fixtures",
      {
        headers: {
          "x-apisports-key": API_KEY
        },
        params: {
          team: teamId,
          last: 5
        }
      }
    );

// console.log(
//   JSON.stringify(
//     response.data,
//     null,
//     2
//   )
// );

    res.json(response.data.response);

  } catch (error) {

    console.log("ERROR:", error.response?.data);
    console.log("MESSAGE:", error.message);

    res.status(500).json({
      error: "Error obteniendo últimos partidos"
    });

  }
});

app.get("/team-fixtures/:team", async (req, res) => {
  try {

    const team = req.params.team;

    const response = await axios.get(
      "https://v3.football.api-sports.io/fixtures",
      {
        headers: {
          "x-apisports-key": API_KEY
        },
        params: {
          team: team,
          season: 2024
        }
      }
    );

    // console.log(
//   JSON.stringify(
//     response.data,
//     null,
//     2
//   )
// );

    res.json(response.data.response);

  } catch (error) {

    console.log(error.response?.data);

    res.status(500).json({
      error: "Error obteniendo fixtures"
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

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});