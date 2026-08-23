require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateTeamStats() {
  console.log("====================================");
  console.log("📊 ACTUALIZANDO ESTADÍSTICAS");
  console.log("====================================");

  // Obtener todos los partidos terminados
  const { data: matches, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "FT");

  if (error) {
    console.error("❌ ERROR OBTENIENDO PARTIDOS:", error);
    return;
  }

  if (!matches || matches.length === 0) {
    console.log("⚠️ No hay partidos terminados.");
    return;
  }

  console.log(`📦 Partidos terminados encontrados: ${matches.length}`);

  const stats = {};

  // Procesar cada partido
  for (const match of matches) {
    const homeId = Number(match.home_team_id);
    const awayId = Number(match.away_team_id);

    const homeName = match.home_team_name;
    const awayName = match.away_team_name;

    const homeGoals = Number(match.home_score ?? 0);
    const awayGoals = Number(match.away_score ?? 0);

    if (!homeId || !awayId) {
      console.log(
        `⚠️ Partido ${match.id} ignorado: faltan IDs de equipos`
      );
      continue;
    }

    // Crear estadísticas del local si no existen
    if (!stats[homeId]) {
      stats[homeId] = {
        team_id: homeId,
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
    if (!stats[awayId]) {
      stats[awayId] = {
        team_id: awayId,
        team_name: awayName,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0
      };
    }

    // Partidos jugados
    stats[homeId].matches++;
    stats[awayId].matches++;

    // Goles
    stats[homeId].goals_for += homeGoals;
    stats[homeId].goals_against += awayGoals;

    stats[awayId].goals_for += awayGoals;
    stats[awayId].goals_against += homeGoals;

    // Resultado
    if (homeGoals > awayGoals) {
      stats[homeId].wins++;
      stats[awayId].losses++;
    } else if (homeGoals < awayGoals) {
      stats[awayId].wins++;
      stats[homeId].losses++;
    } else {
      stats[homeId].draws++;
      stats[awayId].draws++;
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
      onConflict: "team_id"
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