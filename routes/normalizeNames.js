const express = require("express");
const router = express.Router();
const { supabase } = require("../index");
const { getDisplayTeamName } = require("../services/teamAliases");
const { getDisplayLeagueName } = require("../services/leagueAliases");

router.get("/", async (req, res) => {
  try {
    let camposActualizados = 0;

   let data = [];
   let desde = 0;
   const tamañoPagina = 1000;

while (true) {
  const { data: pagina, error } = await supabase
    .from("matches")
    .select("home_team_name, away_team_name, league_name")
    .range(desde, desde + tamañoPagina - 1);

  if (error) throw error;
  if (!pagina || pagina.length === 0) break;

  data = data.concat(pagina);
  desde += tamañoPagina;

  if (pagina.length < tamañoPagina) break;
}

console.log(`📦 Total de partidos leídos para normalizar: ${data.length}`);

    const nombresHome = [...new Set(data.map((m) => m.home_team_name).filter(Boolean))];
    const nombresAway = [...new Set(data.map((m) => m.away_team_name).filter(Boolean))];
    const nombresLiga = [...new Set(data.map((m) => m.league_name).filter(Boolean))];

    for (const nombre of nombresHome) {
      const nuevoNombre = getDisplayTeamName(nombre);
      if (nuevoNombre !== nombre) {
        const { error: updError } = await supabase
          .from("matches")
          .update({ home_team_name: nuevoNombre })
          .eq("home_team_name", nombre);
        if (!updError) {
          console.log(`✅ home_team_name: "${nombre}" → "${nuevoNombre}"`);
          camposActualizados++;
        }
      }
    }

    for (const nombre of nombresAway) {
      const nuevoNombre = getDisplayTeamName(nombre);
      if (nuevoNombre !== nombre) {
        const { error: updError } = await supabase
          .from("matches")
          .update({ away_team_name: nuevoNombre })
          .eq("away_team_name", nombre);
        if (!updError) {
          console.log(`✅ away_team_name: "${nombre}" → "${nuevoNombre}"`);
          camposActualizados++;
        }
      }
    }

    for (const nombre of nombresLiga) {
      const nuevoNombre = getDisplayLeagueName(nombre);
      if (nuevoNombre !== nombre) {
        const { error: updError } = await supabase
          .from("matches")
          .update({ league_name: nuevoNombre })
          .eq("league_name", nombre);
        if (!updError) {
          console.log(`✅ league_name: "${nombre}" → "${nuevoNombre}"`);
          camposActualizados++;
        }
      }
    }

    res.json({ mensaje: "Normalización completa", camposActualizados });
  } catch (error) {
    console.error("❌ ERROR NORMALIZANDO NOMBRES:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;