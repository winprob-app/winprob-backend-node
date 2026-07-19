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

app.get("/matches-live", async (req, res) => {

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

});

app.get("/matches-v2", async (req, res) => {

  try {

const today = new Date();

const from = today.toISOString().split("T")[0];

const future = new Date(today);
future.setDate(today.getDate() + 9);

const to = future.toISOString().split("T")[0];

const [scheduledResponse, liveResponse] = await Promise.all([

  axios.get(
    `https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`,
    {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_KEY
      }
    }
  ),

  axios.get(
    "https://api.football-data.org/v4/matches",
    {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_KEY
      }
    }
  )

]);

const allMatches = [

  ...scheduledResponse.data.matches,

  ...liveResponse.data.matches

];

const uniqueMatches = [
  ...new Map(
    allMatches.map(match => [match.id, match])
  ).values()
];

const allowedCompetitions = [

  "WC",      // Mundial
  "CL",      // Champions
  "PL",      // Premier League
  "PD",      // La Liga
  "SA",      // Serie A
  "BL1",     // Bundesliga
  "FL1",     // Ligue 1

  "EL",      // Europa League
  "ECL",     // Conference League

  "BSA",     // Brasileirão
  "DED",     // Eredivisie
  "PPL",     // Primeira Liga

];

console.log(
  "PARTIDOS TOTALES:",
  allMatches.length
);

const filteredMatches = uniqueMatches.filter(match =>
  allowedCompetitions.includes(match.competition.code)
);

const validMatches = filteredMatches.filter(match =>

  match.homeTeam &&
  match.awayTeam &&

  match.homeTeam.id &&
  match.awayTeam.id &&

  match.homeTeam.name &&
  match.awayTeam.name

);

    const matches = validMatches.map(match => ({

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

  },

  goals: {

    home: match.score.fullTime.home,

    away: match.score.fullTime.away

  }

}));

console.log("TOTAL ENVIADOS:", matches.length);

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
app.get("/team-stats/:teamId", async (req, res) => {

  try {

    const teamId = req.params.teamId;

    const response = await axios.get(
  `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=5`,
  {
    headers: {
      "X-Auth-Token": FOOTBALL_DATA_KEY
    }
  }
);
    const matches = response.data.matches;

    console.log(JSON.stringify(matches, null, 2));

    let wins = 0;
    let draws = 0;
    let losses = 0;

    let goalsFor = 0;
    let goalsAgainst = 0;

    matches.forEach(match => {

      const isHome =
        match.homeTeam.id == teamId;

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

    res.json({

      wins,
      draws,
      losses,

      goalsForAverage:
        Number(
          goalsFor / matches.length
        ).toFixed(2),

      goalsAgainstAverage:
        Number(
          goalsAgainst / matches.length
        ).toFixed(2)

    });

  } catch (error) {

  console.log("ERROR TEAM STATS");

  console.log(error.response?.status);

  console.log(error.response?.data);

  console.log(error.message);

  res.status(500).json({
    error: error.response?.data || error.message
  });

}

});

app.get("/head-to-head/:homeId/:awayId", async (req, res) => {

  try {

    const homeId = req.params.homeId;
    const awayId = req.params.awayId;

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

          if (hg > ag) homeWins++;
          else awayWins++;

        } else {

          if (ag > hg) homeWins++;
          else awayWins++;

        }

      }

    });

    res.json({

      homeWins,
      awayWins,
      draws,
      matches: matches.length

    });

  } catch (error) {

    console.log(error.response?.data || error.message);

    res.status(500).json({
      error: "Error Head To Head"
    });

  }

});

app.get("/team-form/:teamId", async (req, res) => {

  try {

    const teamId = req.params.teamId;

    const response = await axios.get(
      `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=5`,
      {
        headers: {
          "X-Auth-Token": FOOTBALL_DATA_KEY
        }
      }
    );

    res.json(response.data.matches);

  } catch (error) {

    console.log(error.response?.data || error.message);

    res.status(500).json({
      error: "Error obteniendo forma"
    });

  }

});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});