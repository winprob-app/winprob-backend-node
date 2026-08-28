const axios = require("axios");
require("dotenv").config();

const APIFOOTBALL_KEY = process.env.APIFOOTBALL_KEY;

const BASE_URL = "https://v3.football.api-sports.io";

const allowedApiFootballLeagueIds = [
  262, // Liga MX
  61, // Ligue 1 (Francia)
  253, // Major League Soccer
  76, // Serie D (Brasil)
  13, // Copa Libertadores
  11, // Copa Sudamericana
  307, // Pro League (Arabia Saudita)
  71, // Serie A (Brasil)
  239, // Primera A (Colombia)
  265, // Primera Division (Chile)
  128, // Liga Profesional Argentina
  129, // Primera Nacional (Argentina)
  40, // Championship (Inglaterra)
  88, // Eredivisie (Holanda)
  95, // Segunda Liga (Portugal)
  250, // Division Profesional (Paraguay)
  141, // La Liga 2 (España)
  94, // Primeira Liga (Portugal)
  140, // La Liga (España)
  78, // Bundesliga (Alemania)
  62, // Ligue 2 (Francia)
  241, // Copa Colombia
  72, // Serie B (Brasil)
];

/**
 * Consulta fixtures de API-Football.
 */
async function getFixtures(params) {
  try {
    const response = await axios.get(
      `${BASE_URL}/fixtures`,
      {
        params,
        headers: {
          "x-apisports-key": APIFOOTBALL_KEY,
        },
      }
    );

    return response.data;

  } catch (error) {
    console.error(
      "❌ ERROR CONSULTANDO API-Football:",
      error.response?.data || error.message
    );

    return {};
  }
}

/**
 * Busca ligas en API-Football.
 */
async function getLeagues(params) {
  try {
    const response = await axios.get(
      `${BASE_URL}/leagues`,
      {
        params,
        headers: {
          "x-apisports-key": APIFOOTBALL_KEY,
        },
      }
    );

    return response.data;

  } catch (error) {
    console.error(
      "❌ ERROR CONSULTANDO LIGAS API-Football:",
      error.response?.data || error.message
    );

    return {};
  }
}

/**
 * Consulta y convierte los partidos de una fecha al formato de WinProb.
 */
async function getMatchesByDate(date) {
  try {
    const data = await getFixtures({ date });
    const fixtures = Array.isArray(data?.response)
      ? data.response
      : [];

    console.log(
      "📊 TOTAL FIXTURES CRUDOS API-FOOTBALL:",
      fixtures.length
    );

    const ligasDescartadas = [...new Set(
      fixtures
        .filter(fixture =>
          !allowedApiFootballLeagueIds.includes(fixture?.league?.id)
        )
        .map(fixture => fixture?.league?.name)
    )];

    console.log(
      "❌ LIGAS DESCARTADAS POR EL FILTRO:",
      ligasDescartadas
    );

    const filteredFixtures = fixtures.filter(fixture =>
      allowedApiFootballLeagueIds.includes(fixture?.league?.id)
    );

    console.log(
      "✅ FIXTURES QUE PASARON EL FILTRO:",
      filteredFixtures.length
    );

    return filteredFixtures
      .map(fixture => {
        const status = fixture.fixture?.status?.short;

        return {
          idEvent: -(1000000000 + fixture.fixture.id),

          idHomeTeam: fixture.teams?.home?.id,
          strHomeTeam: fixture.teams?.home?.name,

          idAwayTeam: fixture.teams?.away?.id,
          strAwayTeam: fixture.teams?.away?.name,

          idLeague: fixture.league?.id,
          strLeague: fixture.league?.name,

          strTimestamp: fixture.fixture?.date,

          strStatus:
            ["FT", "AET", "PEN"].includes(status)
              ? "FT"
              : ["NS", "TBD", "PST", "CANC", "ABD"].includes(status)
                ? "NS"
                : "LIVE",

          intHomeScore: fixture.goals?.home ?? null,
          intAwayScore: fixture.goals?.away ?? null,

          strLeagueBadge: fixture.league?.logo || "",
          strHomeTeamBadge: fixture.teams?.home?.logo || "",
          strAwayTeamBadge: fixture.teams?.away?.logo || ""
        };
      });

  } catch (error) {
    console.error(
      "❌ ERROR CONSULTANDO FIXTURES API-Football:",
      error.response?.data || error.message
    );

    return [];
  }
}

module.exports = {
  getFixtures,
  getLeagues,
  getMatchesByDate,
  allowedApiFootballLeagueIds,
};
