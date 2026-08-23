const axios = require("axios");
require("dotenv").config();

const ISPORTS_API_KEY = process.env.ISPORTS_API_KEY;

const BASE_URL = "https://api.isportsapi.com";

/**
 * Consulta los partidos de fútbol de una fecha.
 */
async function getMatchesByDate(date) {
  try {
    const response = await axios.get(
      `${BASE_URL}/sport/football/schedule/basic`,
      {
        params: {
          api_key: ISPORTS_API_KEY,
          date: date,
        },
      }
    );

    if (response.data?.code !== 0) {
      console.error(
        "❌ iSports ERROR:",
        response.data?.message
      );

      return [];
    }

    const data = response.data?.data || [];

    if (data.length > 0) {
      console.log("=== DIAGNÓSTICO iSPORTS PRIMER EVENTO ===");
      console.log(Object.keys(data[0]));
      console.log(JSON.stringify(data[0], null, 2));
      console.log("=== FIN DIAGNÓSTICO iSPORTS PRIMER EVENTO ===");
    }

    return data;

  } catch (error) {
    console.error(
      "❌ ERROR CONSULTANDO iSports:",
      error.response?.data || error.message
    );

    return [];
  }
}

/**
 * Consulta el perfil de un equipo (incluye su logo).
 */
async function getTeamsByLeague(leagueId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/sport/football/team`,
      {
        params: {
          api_key: ISPORTS_API_KEY,
          leagueId: leagueId,
        },
      }
    );

    if (response.data?.code !== 0) {
      console.error(
        "❌ iSports ERROR (teams by league):",
        response.data?.message
      );
      return [];
    }

    const data = response.data?.data || [];
    return Array.isArray(data) ? data : [data];

  } catch (error) {
    console.error(
      "❌ ERROR CONSULTANDO EQUIPOS DE LIGA iSports:",
      error.response?.data || error.message
    );
    return [];
  }
}

module.exports = {
  getMatchesByDate,
  getTeamsByLeague,
};