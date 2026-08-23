const express = require("express");
const router = express.Router();
const { supabase } = require("../index");

router.get("/", async (req, res) => {
  try {
    const { teamName } = req.query;

    if (!teamName) {
      return res.status(400).json({ error: "Falta el parámetro teamName" });
    }

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "FT")
      .or(`home_team_name.eq.${teamName},away_team_name.eq.${teamName}`)
      .order("fixture_date", { ascending: false })
      .limit(5);

    if (error) {
      console.error("❌ ERROR CONSULTANDO ÚLTIMOS PARTIDOS:", error.message);
      return res.status(500).json({ error: "Error consultando partidos" });
    }

    res.json(data);

  } catch (error) {
    console.error("❌ ERROR EN /team-matches:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;