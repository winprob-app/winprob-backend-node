require("dotenv").config();

console.log("========== INDEX NUEVO ==========");
console.log("SOY EL INDEX LOCAL DE DUVAN");

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");

const matchesRouter = require("./routes/matches");
const logoRouter = require("./routes/logo");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================
// RUTAS
// ==========================

app.use("/matches", matchesRouter);
app.use("/logo", logoRouter);

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

app.listen(PORT, () => {

  console.log(
    `🚀 Servidor corriendo en puerto ${PORT}`
  );

});