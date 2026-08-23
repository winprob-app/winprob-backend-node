const express = require("express");
const router = express.Router();
const { supabase } = require("../index");

router.get("/", async (req, res) => {
  try {
    const teamId = Number(req.query.teamId);
    const limit = Number(req.query.limit) || 10;

    if (!teamId) {
      return res.status(400).json({
        error: "Falta teamId"
      });
    }

    console.log(
      `📊 BUSCANDO ÚLTIMOS ${limit} PARTIDOS DEL EQUIPO: ${teamId}`
    );

    const { data: matches, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "FT")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("fixture_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("❌ ERROR SUPABASE:", error);

      return res.status(500).json({
        error: error.message
      });
    }

    if (!matches || matches.length === 0) {
      return res.json({
        teamId,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        avgGoalsFor: "0.00",
        avgGoalsAgainst: "0.00",

        home: {
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          avgGoalsFor: "0.00",
          avgGoalsAgainst: "0.00"
        },

        away: {
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          avgGoalsFor: "0.00",
          avgGoalsAgainst: "0.00"
        },

        recentMatches: []
      });
    }

    let wins = 0;
    let draws = 0;
    let losses = 0;

    let goalsFor = 0;
    let goalsAgainst = 0;

    const homeStats = {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0
    };

    const awayStats = {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0
    };

    const recentMatches = matches.map((match) => {

      const isHome =
        Number(match.home_team_id) === teamId;

      const gf = Number(
        isHome
          ? match.home_score
          : match.away_score
      ) || 0;

      const ga = Number(
        isHome
          ? match.away_score
          : match.home_score
      ) || 0;

      goalsFor += gf;
      goalsAgainst += ga;

      let result;

      if (gf > ga) {
        wins++;
        result = "W";
      } else if (gf < ga) {
        losses++;
        result = "L";
      } else {
        draws++;
        result = "D";
      }

      const targetStats =
        isHome
          ? homeStats
          : awayStats;

      targetStats.matches++;

      targetStats.goalsFor += gf;
      targetStats.goalsAgainst += ga;

      if (result === "W") {
        targetStats.wins++;
      } else if (result === "L") {
        targetStats.losses++;
      } else {
        targetStats.draws++;
      }

      return {
        id: match.id,
        date: match.fixture_date,
        league: match.league_name,

        homeTeam: match.home_team_name,
        awayTeam: match.away_team_name,

        homeScore: match.home_score,
        awayScore: match.away_score,

        goalsFor: gf,
        goalsAgainst: ga,

        result
      };
    });

    const calculateAverages = (stats) => {

      return {
        matches: stats.matches,

        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,

        goalsFor: stats.goalsFor,
        goalsAgainst: stats.goalsAgainst,

        avgGoalsFor:
          stats.matches > 0
            ? (
                stats.goalsFor /
                stats.matches
              ).toFixed(2)
            : "0.00",

        avgGoalsAgainst:
          stats.matches > 0
            ? (
                stats.goalsAgainst /
                stats.matches
              ).toFixed(2)
            : "0.00"
      };
    };

    const result = {

      teamId,

      matches: matches.length,

      wins,
      draws,
      losses,

      goalsFor,
      goalsAgainst,

      avgGoalsFor:
        (
          goalsFor /
          matches.length
        ).toFixed(2),

      avgGoalsAgainst:
        (
          goalsAgainst /
          matches.length
        ).toFixed(2),

      home: calculateAverages(homeStats),

      away: calculateAverages(awayStats),

      recentMatches
    };

    console.log("✅ STATS CALCULADAS:");
    console.log(result);

    res.json(result);

  } catch (error) {

    console.error("❌ ERROR STATS:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;