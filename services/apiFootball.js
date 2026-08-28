const axios = require("axios");
require("dotenv").config();

const APIFOOTBALL_KEY = process.env.APIFOOTBALL_KEY;

const BASE_URL = "https://v3.football.api-sports.io";
const { allowedIsportsLeagues } = require("./allowedLeagues");

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
 * Consulta y convierte los partidos de una fecha al formato de WinProb.
 */
async function getMatchesByDate(date) {
  try {
    const data = await getFixtures({ date });
    const fixtures = Array.isArray(data?.response)
      ? data.response
      : [];

    return fixtures
      .filter(fixture =>
        allowedIsportsLeagues.includes(fixture?.league?.name)
      )
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
  getMatchesByDate,
};
