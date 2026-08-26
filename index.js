require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports.supabase = supabase;

(async () => {

  const { error } = await supabase
    .from("matches")
    .select("*")
    .limit(1);

  if (error) {
    console.log("❌ ERROR SUPABASE:", error.message);
  } else {
    console.log("✅ SUPABASE CONECTADO");
  }

})();

console.log("========== INDEX NUEVO ==========");
console.log("SOY EL INDEX LOCAL DE DUVAN");

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const statsRouter = require("./routes/stats");
const updateTeamStats = require("./services/updateTeamStats");
const { runLogoSyncTick } = require("./services/logoSync");

const matchesRouter = require("./routes/matches");
const logoRouter = require("./routes/logo");
const teamMatchesRouter = require("./routes/teamMatches");
const headToHeadRouter = require("./routes/headToHead");
const importHistoryRouter = require("./routes/importHistory");
const importHistorySouthAmericaRouter = require("./routes/importHistorySouthAmerica");
const syncLogosRouter = require("./routes/syncLogos");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================
// RUTAS
// ==========================

app.use("/matches", matchesRouter);
app.use("/stats", statsRouter);
app.use("/logo", logoRouter);
app.use("/team-matches", teamMatchesRouter);
app.use("/head-to-head", headToHeadRouter);
app.use("/import-history", importHistoryRouter);
app.use("/import-history-sa", importHistorySouthAmericaRouter);
app.use("/sync-logos", syncLogosRouter);

// ==========================
// VARIABLES
// ==========================

const PORT = process.env.PORT || 3000;

const LOGOS_FOLDER = path.join(
  __dirname,
  "logos",
  "teams"
);

fs.ensureDirSync(LOGOS_FOLDER);

// ==========================
// HEALTH
// ==========================

app.get("/health", (req, res) => {

  res.json({

    status: "ok",

    server: "WinProb Backend",

    version: "2.0.0",

    uptime: Math.floor(process.uptime()),

    timestamp: new Date().toISOString()

  });

});

// ==========================
// MAPA DE LOGOS
// ==========================

const teamLogoMap = {

  770: "england",
  762: "argentina",
  760: "spain",
  773: "france",
  769: "brazil",
  758: "germany",
  765: "netherlands",
  764: "belgium",

  563: "real-madrid",
  81: "barcelona",
  64: "liverpool",
  65: "manchester-city",
  66: "manchester-united"

};

// ==========================
// INICIAR SERVIDOR
// ==========================

app.listen(PORT, "0.0.0.0", async () => {

  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);

  try {
    await updateTeamStats();
  } catch (error) {
    console.error("❌ ERROR ACTUALIZANDO TEAM_STATS:", error);
  }

  runLogoSyncTick();
  setInterval(runLogoSyncTick, 31 * 60 * 1000);

});