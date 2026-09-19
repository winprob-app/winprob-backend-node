const express = require("express");
const router = express.Router();
const { supabase } = require("../index");
const { getDisplayTeamName } = require("../services/teamAliases");

router.get("/", async (req, res) => {
  try {
    const teamName = getDisplayTeamName(req.query.teamName);

    if (!teamName) {
      return res.status(400).json({
        error: "Falta un teamName válido"
      });
    }

    const { data, error } = await supabase
      .from("team_stats")
      .select("*")
      .eq("team_name", teamName)
      .maybeSingle();

    if (error) {
      console.error("❌ ERROR CONSULTANDO TEAM_STATS:", error);
      return res.status(500).json({
        error: error.message
      });
    }

    if (!data) {
      return res.json({
        team_id: null,
        team_name: teamName,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        avg_goals_for: 0,
        avg_goals_against: 0,
        avgGoalsFor: 0,
        avgGoalsAgainst: 0
      });
    }

    return res.json({
      ...data,
      avgGoalsFor: data.avg_goals_for ?? 0,
      avgGoalsAgainst: data.avg_goals_against ?? 0
    });
  } catch (error) {
    console.error("❌ ERROR EN /team-stats:", error.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;
