const express = require("express");
const router = express.Router();
const { supabase } = require("../index");

router.get("/", async (req, res) => {
  try {
    const { team1, team2 } = req.query;

    if (!team1 || !team2) {
      return res.status(400).json({ error: "Faltan team1 o team2" });
    }

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "FT")
      .or(
        `and(home_team_name.eq.${team1},away_team_name.eq.${team2}),and(home_team_name.eq.${team2},away_team_name.eq.${team1})`
      )
      .order("fixture_date", { ascending: false })
      .limit(5);

    if (error) {
      console.error("❌ ERROR H2H:", error.message);
      return res.status(500).json({ error: "Error consultando H2H" });
    }

    res.json(data);

  } catch (error) {
    console.error("❌ ERROR EN /head-to-head:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;