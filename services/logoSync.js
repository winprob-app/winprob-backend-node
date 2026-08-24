const { supabase } = require("../index");
const { getTeamsByLeague } = require("./isports");
const { cacheTeamLogoFromUrl, getTeamLogoFromCache, sleep } = require("./logoStorage");
const { allowedIsportsLeagues } = require("./allowedLeagues");
const { normalizeLogoName } = require("./logoCatalog");

const STATE_KEY = "logo_sync_league_index";

async function getSavedIndex() {
  const { data, error } = await supabase
    .from("app_state")
    .select("value")
    .eq("key", STATE_KEY)
    .maybeSingle();

  if (error) {
    console.error("❌ ERROR LEYENDO PROGRESO DE SYNC:", error.message);
    return 0;
  }

  return data?.value ? parseInt(data.value) : 0;
}

async function saveIndex(index) {
  const { error } = await supabase
    .from("app_state")
    .upsert(
      { key: STATE_KEY, value: String(index) },
      { onConflict: "key" }
    );

  if (error) {
    console.error("❌ ERROR GUARDANDO PROGRESO DE SYNC:", error.message);
  }
}

async function runLogoSyncTick() {
  try {
            const { data: leagueRows, error } = await supabase
      .rpc("get_isports_leagues");

    if (error) {
      console.error("❌ ERROR LEYENDO LIGAS PARA SYNC AUTOMÁTICO:", error.message);
      return;
    }

    const filteredLeagueRows = leagueRows.filter(row =>
      allowedIsportsLeagues.includes(row.league_name)
    );

        const leagueIds = [...new Set(filteredLeagueRows.map(row => row.league_id))].filter(Boolean);

    if (leagueIds.length === 0) {
      console.log("ℹ️ SYNC AUTOMÁTICO: no hay ligas para procesar todavía");
      return;
    }

    const leagueNamesList = [...new Set(filteredLeagueRows.map(row => row.league_name))];

    console.log(`📅 LIGAS CON PARTIDOS HOY (${leagueNamesList.length}):`);
    leagueNamesList.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));

    let leagueIndex = await getSavedIndex();

    if (leagueIndex >= leagueIds.length) {
      leagueIndex = 0;
    }

    const leagueId = leagueIds[leagueIndex];

    console.log(`🔁 SYNC AUTOMÁTICO: procesando liga ${leagueId} (${leagueIndex + 1}/${leagueIds.length})`);

    const teams = await getTeamsByLeague(leagueId);
    console.log(`📋 Liga ${leagueId}: ${teams.length} equipos`);

    let nuevos = 0;
    let saltados = 0;

    for (const team of teams) {
      if (!team?.logo || !team?.name) continue;

      const yaExiste = await getTeamLogoFromCache(team.name);

      if (yaExiste) {
        saltados++;
        continue;
      }

      await cacheTeamLogoFromUrl(team.teamId, team.name, team.logo);
      nuevos++;
      await sleep(400);
    }

    console.log(`✅ Liga ${leagueId}: ${nuevos} nuevos, ${saltados} ya existían`);

    await saveIndex((leagueIndex + 1) % leagueIds.length);

  } catch (error) {
    console.error("❌ ERROR EN SYNC AUTOMÁTICO DE LOGOS:", error.message);
  }
}

module.exports = { runLogoSyncTick };