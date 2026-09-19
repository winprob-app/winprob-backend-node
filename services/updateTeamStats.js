require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { getDisplayTeamName } = require("./teamAliases");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateTeamStats() {
  console.log("====================================");
  console.log("📊 ACTUALIZANDO ESTADÍSTICAS");
  console.log("====================================");

  // Obtener todos los partidos terminados por páginas de Supabase
  let matches = [];
  let desde = 0;
  const tamañoPagina = 1000;

  while (true) {
    const { data: pagina, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "FT")
      .order("id")
      .range(desde, desde + tamañoPagina - 1);

    if (error) {
      console.error("❌ ERROR OBTENIENDO PARTIDOS:", error);
      return;
    }

    if (!pagina || pagina.length === 0) break;

    matches = matches.concat(pagina);
    desde += tamañoPagina;

    if (pagina.length < tamañoPagina) break;
  }

  if (!matches || matches.length === 0) {
    console.log("⚠️ No hay partidos terminados.");
    return;
  }

  console.log(`📦 Partidos terminados encontrados: ${matches.length}`);

  const stats = {};

  // Procesar cada partido
  for (const match of matches) {
    const homeName = getDisplayTeamName(match.home_team_name);
    const awayName = getDisplayTeamName(match.away_team_name);

    if (!homeName || !awayName) {
      console.log(
        `⚠️ Partido ${match.id} ignorado: faltan nombres de equipos`
      );
      continue;
    }

    const homeId = Number(match.home_team_id);
    const awayId = Number(match.away_team_id);

    const homeGoals = Number(match.home_score ?? 0);
    const awayGoals = Number(match.away_score ?? 0);

    // Agrupar por el nombre canónico, no por IDs de fuentes externas.
    if (!stats[homeName]) {
      stats[homeName] = {
        team_id: Number.isInteger(homeId) && homeId > 0 ? homeId : null,
        team_name: homeName,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0
      };
    }

    // Crear estadísticas del visitante si no existen
    if (!stats[awayName]) {
      stats[awayName] = {
        team_id: Number.isInteger(awayId) && awayId > 0 ? awayId : null,
        team_name: awayName,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0
      };
    }

    if (Number.isInteger(homeId) && homeId > 0) {
      stats[homeName].team_id = homeId;
    }
    if (Number.isInteger(awayId) && awayId > 0) {
      stats[awayName].team_id = awayId;
    }

    // Partidos jugados
    stats[homeName].matches++;
    stats[awayName].matches++;

    // Goles
    stats[homeName].goals_for += homeGoals;
    stats[homeName].goals_against += awayGoals;

    stats[awayName].goals_for += awayGoals;
    stats[awayName].goals_against += homeGoals;

    // Resultado
    if (homeGoals > awayGoals) {
      stats[homeName].wins++;
      stats[awayName].losses++;
    } else if (homeGoals < awayGoals) {
      stats[awayName].wins++;
      stats[homeName].losses++;
    } else {
      stats[homeName].draws++;
      stats[awayName].draws++;
    }
  }

  // Preparar datos para team_stats
  const teamStats = Object.values(stats).map((team) => {
    const avgGoalsFor =
      team.matches > 0
        ? team.goals_for / team.matches
        : 0;

    const avgGoalsAgainst =
      team.matches > 0
        ? team.goals_against / team.matches
        : 0;

    return {
      team_id: team.team_id,
      team_name: team.team_name,
      matches: team.matches,
      wins: team.wins,
      draws: team.draws,
      losses: team.losses,
      goals_for: team.goals_for,
      goals_against: team.goals_against,
      avg_goals_for: Number(avgGoalsFor.toFixed(2)),
      avg_goals_against: Number(avgGoalsAgainst.toFixed(2)),
      updated_at: new Date().toISOString()
    };
  });

  console.log(`👥 Equipos calculados: ${teamStats.length}`);

  // Guardar en Supabase
  const { error: upsertError } = await supabase
    .from("team_stats")
    .upsert(teamStats, {
      onConflict: "team_name"
    });

  if (upsertError) {
    console.error(
      "❌ ERROR GUARDANDO ESTADÍSTICAS:",
      upsertError
    );
    return;
  }

  console.log("====================================");
  console.log("✅ ESTADÍSTICAS ACTUALIZADAS");
  console.log("====================================");

  // Mostrar los primeros resultados
  for (const team of teamStats.slice(0, 10)) {
    console.log(
      `${team.team_name} | ` +
      `PJ: ${team.matches} | ` +
      `G: ${team.wins} | ` +
      `E: ${team.draws} | ` +
      `P: ${team.losses} | ` +
      `GF: ${team.goals_for} | ` +
      `GC: ${team.goals_against} | ` +
      `AVG GF: ${team.avg_goals_for} | ` +
      `AVG GC: ${team.avg_goals_against}`
    );
  }
}

module.exports = updateTeamStats;