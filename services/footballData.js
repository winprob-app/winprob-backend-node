const axios = require("axios");
require("dotenv").config();

const FOOTBALLDATA_API_KEY = process.env.FOOTBALLDATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

/**
 * Consulta partidos por rango de fechas en Football Data.
 */
async function getMatchesByDateRange(dateFrom, dateTo) {
  try {
    const response = await axios.get(
      `${BASE_URL}/matches`,
      {
        params: {
          dateFrom,
          dateTo,
        },
        headers: {
          "X-Auth-Token": FOOTBALLDATA_API_KEY,
        },
      }
    );

    return response.data;

  } catch (error) {
    const status = error.response?.status;

    if (status === 429) {
      console.error(
        "❌ ERROR CONSULTANDO MATCHES FOOTBALL-DATA: LÍMITE DE 10 LLAMADAS POR MINUTO EXCEDIDO",
        error.response?.data || error.message
      );
    } else {
      console.error(
        "❌ ERROR CONSULTANDO MATCHES FOOTBALL-DATA:",
        error.response?.data || error.message
      );
    }

    return null;
  }
}

/**
 * Convierte partidos de Football Data al formato final usado por matches.js.
 */
async function getMatchesConverted(dateFrom, dateTo) {
  try {
    const data = await getMatchesByDateRange(dateFrom, dateTo);
    const matches = Array.isArray(data?.matches) ? data.matches : [];

    return matches
      .filter(match => match?.homeTeam?.id && match?.awayTeam?.id)
      .map(match => {
        const status = match?.status;

        return {
          idEvent: -(2000000000 + match.id),

          idHomeTeam: match.homeTeam.id,
          strHomeTeam: match.homeTeam.name,

          idAwayTeam: match.awayTeam.id,
          strAwayTeam: match.awayTeam.name,

          idLeague: match.competition?.id,
          strLeague: match.competition?.name,

          strTimestamp: match.utcDate,

          strStatus:
            status === "FINISHED"
              ? "FT"
              : ["SCHEDULED", "TIMED", "POSTPONED", "SUSPENDED", "CANCELLED"].includes(status)
                ? "NS"
                : "LIVE",

          intHomeScore: match.score?.fullTime?.home ?? null,
          intAwayScore: match.score?.fullTime?.away ?? null,

          strLeagueBadge: match.competition?.emblem || "",
          strHomeTeamBadge: match.homeTeam?.crest || "",
          strAwayTeamBadge: match.awayTeam?.crest || "",
        };
      });

  } catch (error) {
    console.error(
      "❌ ERROR CONVIRTIENDO MATCHES FOOTBALL-DATA:",
      error.message
    );

    return [];
  }
}

module.exports = {
  getMatchesByDateRange,
  getMatchesConverted,
};
