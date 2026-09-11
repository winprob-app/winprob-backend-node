const express = require("express");
const router = express.Router();
const axios = require("axios");
const { supabase } = require("../index");

const FOOTBALLDATA_API_KEY = process.env.FOOTBALLDATA_API_KEY;
const SEASONS = [2024, 2025]; // 2024 = temporada 2024-25, 2025 = temporada 2025-26 actual

router.get("/", async (req, res) => {
  try {
    let totalImportados = 0;

    for (const season of SEASONS) {
      console.log(`⬇️ Descargando Champions League temporada ${season}`);

      let matches;
      try {
        const response = await axios.get(
          `https://api.football-data.org/v4/competitions/CL/matches`,
          {
            params: { season },
            headers: { "X-Auth-Token": FOOTBALLDATA_API_KEY },
          }
        );
        matches = Array.isArray(response.data?.matches) ? response.data.matches : [];
      } catch (error) {
        console.error(`❌ ERROR DESCARGANDO CHAMPIONS ${season}:`, error.response?.data || error.message);
        continue;
      }

      const finished = matches.filter(m => m.status === "FINISHED");
      console.log(`📋 Champions ${season}: ${finished.length} partidos finalizados`);

      const rowsToInsert = finished.map((match) => ({
        id: 920000000000 + match.id, // rango propio, distinto al de Sudamérica (910000000000) y al de matches.js en vivo
        league_id: match.competition?.id || null,
        league_name: "UEFA Champions League",
        fixture_date: match.utcDate,
        status: "FT",
        home_team_id: match.homeTeam?.id || null,
        home_team_name: match.homeTeam?.name,
        away_team_id: match.awayTeam?.id || null,
        away_team_name: match.awayTeam?.name,
        home_score: match.score?.fullTime?.home ?? null,
        away_score: match.score?.fullTime?.away ?? null,
        source: "football-data-cl",
        source_match_id: String(match.id),
      }));

      if (rowsToInsert.length > 0) {
        const { error } = await supabase
          .from("matches")
          .upsert(rowsToInsert, { onConflict: "source,source_match_id" });

        if (error) {
          console.error(`❌ ERROR GUARDANDO CHAMPIONS ${season}:`, error.message);
        } else {
          console.log(`✅ Champions ${season}: ${rowsToInsert.length} partidos guardados`);
          totalImportados += rowsToInsert.length;
        }
      }
    }

    res.json({ mensaje: "Importación Champions League completa", partidosImportados: totalImportados });

  } catch (error) {
    console.error("❌ ERROR EN IMPORTACIÓN CHAMPIONS LEAGUE:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;