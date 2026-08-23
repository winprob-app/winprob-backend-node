const express = require("express");
const router = express.Router();
const { supabase } = require("../index");
const { getTeamsByLeague } = require("../services/isports");
const { cacheTeamLogoFromUrl, sleep } = require("../services/logoStorage");
const { allowedIsportsLeagues } = require("../services/allowedLeagues");


router.get("/", async (req, res) => {
  try {
    const { data: leagueRows, error } = await supabase
  .from("matches")
  .select("league_id, league_name")
  .lt("id", 0); // negativo = viene de iSports

if (error) {
  console.error("❌ ERROR LEYENDO LIGAS:", error.message);
  return res.status(500).json({ error: "No se pudieron leer las ligas" });
}

const filteredLeagueRows = leagueRows.filter(row =>
  allowedIsportsLeagues.includes(row.league_name)
);

const leagueIds = [...new Set(filteredLeagueRows.map(row => row.league_id))].filter(Boolean);

    console.log(`🔁 SINCRONIZANDO LOGOS DE ${leagueIds.length} LIGAS`);

    let totalGuardados = 0;

    for (const leagueId of leagueIds) {
      const teams = await getTeamsByLeague(leagueId);
      console.log(`📋 Liga ${leagueId}: ${teams.length} equipos`);

      for (const team of teams) {
        if (!team?.logo) continue;

        const saved = await cacheTeamLogoFromUrl(team.teamId, team.name, team.logo);
        if (saved) totalGuardados++;

        await sleep(400);
      }

      await sleep(1000);
    }

    res.json({ mensaje: "Sincronización completa", logosGuardados: totalGuardados });

  } catch (error) {
    console.error("❌ ERROR EN SINCRONIZACIÓN DE LOGOS:", error.message);
    res.status(500).json({ error: "Error sincronizando logos" });
  }
});

module.exports = router;