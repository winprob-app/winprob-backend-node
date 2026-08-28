const axios = require("axios");
require("dotenv").config();

const APIFOOTBALL_KEY = process.env.APIFOOTBALL_KEY;

const BASE_URL = "https://v3.football.api-sports.io";

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

module.exports = {
  getFixtures,
};
