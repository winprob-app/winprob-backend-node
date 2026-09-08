const express = require("express");
const router = express.Router();
const { supabase } = require("../index");

// Se llama UNA VEZ cuando la app abre: registra la visita y marca la sesión como activa
router.post("/register", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId requerido" });
  }

  try {
    await supabase.from("site_visits").insert({ session_id: sessionId });

    await supabase
      .from("active_sessions")
      .upsert({ session_id: sessionId, last_seen: new Date().toISOString() });

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ ERROR REGISTRANDO VISITA:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// Se llama cada cierto tiempo mientras la app sigue abierta ("sigo aquí")
router.post("/heartbeat", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId requerido" });
  }

  try {
    await supabase
      .from("active_sessions")
      .upsert({ session_id: sessionId, last_seen: new Date().toISOString() });

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ ERROR EN HEARTBEAT:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// Devuelve el total histórico + cuántas sesiones están activas ahora
router.get("/stats", async (req, res) => {
  try {
    const { count: totalVisits } = await supabase
      .from("site_visits")
      .select("*", { count: "exact", head: true });

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { count: activeNow } = await supabase
      .from("active_sessions")
      .select("*", { count: "exact", head: true })
      .gte("last_seen", twoMinutesAgo);

    res.json({
      totalVisits: totalVisits || 0,
      activeNow: activeNow || 0,
    });
  } catch (error) {
    console.error("❌ ERROR OBTENIENDO STATS:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;