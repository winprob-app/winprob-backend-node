const express = require("express");
const router = express.Router();
const axios = require("axios");
const { supabase } = require("../index");

const LEAGUES = [
  { code: "de.1", displayName: "German Bundesliga" },
  { code: "es.1", displayName: "Spanish La Liga" },
];

const SEASONS = ["2024-25", "2025-26"];

function stableId(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 900000000000 + Math.abs(hash);
}

router.get("/", async (req, res) => {
  try {
    let totalImportados = 0;

    for (const season of SEASONS) {
      for (const league of LEAGUES) {
        const url = `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${league.code}.json`;

        console.log(`⬇️ Descargando: ${league.displayName} ${season}`);

        let data;
        try {
          const response = await axios.get(url);
          data = response.data;
        } catch (error) {
          console.error(`❌ ERROR DESCARGANDO ${league.displayName} ${season}:`, error.message);
          continue;
        }

        const matches = data?.matches || [];
        console.log(`📋 ${league.displayName} ${season}: ${matches.length} partidos en el archivo`);

        const rowsToInsert = [];

        for (const match of matches) {
          const ftScore = match?.score?.ft;
          if (!ftScore) continue;

          const sourceMatchId = `${match.date}_${match.team1}_${match.team2}`;

          rowsToInsert.push({
            id: stableId(sourceMatchId),
            league_id: null,
            league_name: league.displayName,
            fixture_date: match.date,
            status: "FT",
            home_team_id: null,
            home_team_name: match.team1,
            away_team_id: null,
            away_team_name: match.team2,
            home_score: ftScore[0],
            away_score: ftScore[1],
            source: "openfootball",
            source_match_id: sourceMatchId,
          });
        }

        if (rowsToInsert.length > 0) {
          const { error } = await supabase
            .from("matches")
            .upsert(rowsToInsert, { onConflict: "source,source_match_id" });

          if (error) {
            console.error(`❌ ERROR GUARDANDO ${league.displayName} ${season}:`, error.message);
          } else {
            console.log(`✅ ${league.displayName} ${season}: ${rowsToInsert.length} partidos guardados`);
            totalImportados += rowsToInsert.length;
          }
        }
      }
    }

    res.json({ mensaje: "Importación completa", partidosImportados: totalImportados });

  } catch (error) {
    console.error("❌ ERROR EN IMPORTACIÓN HISTÓRICA:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;