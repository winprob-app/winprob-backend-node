const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const {
  TEAM_LOGOS_ROOT,
  LEAGUE_LOGOS_ROOT
} = require("../services/logoCatalog");

const router = express.Router();

// ==========================
// LOGOS MANUALES
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
// DETECTAR IMAGEN REAL
// ==========================

function isImageBuffer(buffer) {

  if (!buffer || buffer.length < 4) {
    return false;
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // JPG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }

  // GIF
  if (
    buffer.toString("ascii", 0, 6) === "GIF87a" ||
    buffer.toString("ascii", 0, 6) === "GIF89a"
  ) {
    return true;
  }

  // WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }

  return false;
}

function sendCatalogLogo(root, fileName, res) {
  const safeFileName = path.basename(fileName);
  const localPath = path.join(root, safeFileName);

  if (!safeFileName || safeFileName !== fileName || !fs.existsSync(localPath)) {
    return res.status(404).end();
  }

  return res.sendFile(localPath);
}

router.get("/team/:file", (req, res) =>
  sendCatalogLogo(TEAM_LOGOS_ROOT, req.params.file, res)
);

router.get("/league/:file", (req, res) =>
  sendCatalogLogo(LEAGUE_LOGOS_ROOT, req.params.file, res)
);

// ==========================
// RUTA
// ==========================

router.get("/", async (req, res) => {

  try {

    const teamId = req.query.teamId;

    let imageUrl = req.query.url;

    if (typeof imageUrl === "string") {
      const localCatalogMatch = imageUrl.match(
        /^\/logo\/(team|league)\/([^/]+)$/
      );

      if (localCatalogMatch) {
        const root = localCatalogMatch[1] === "team"
          ? TEAM_LOGOS_ROOT
          : LEAGUE_LOGOS_ROOT;

        return sendCatalogLogo(root, localCatalogMatch[2], res);
      }
    }

    // ==========================
    // LOGOS MANUALES
    // ==========================

    if (teamId && teamLogoMap[teamId]) {

      imageUrl =
        `https://football-logos.cc/logos/${teamLogoMap[teamId]}.png`;
    }

    if (!imageUrl) {

      return res
        .status(400)
        .send("URL requerida");
    }

    console.log(
      "🖼️ SOLICITANDO LOGO:",
      imageUrl
    );

    // ==========================
    // DESCARGAR IMAGEN
    // ==========================

    const response =
      await axios.get(
        imageUrl,
        {
          responseType: "arraybuffer",

          timeout: 15000,

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",

            "Accept":
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          }
        }
      );

    const buffer =
      Buffer.from(response.data);

    const contentType =
      response.headers["content-type"] || "";

    console.log(
      "📦 CONTENT-TYPE LOGO:",
      contentType
    );

    // ==========================
    // COMPROBAR SI REALMENTE ES IMAGEN
    // ==========================

    if (!isImageBuffer(buffer)) {

      const beginning =
        buffer
          .toString("utf8")
          .substring(0, 100)
          .replace(/\s+/g, " ");

      console.log(
        "⚠️ EL PROVEEDOR NO DEVOLVIÓ UNA IMAGEN:",
        beginning
      );

      return res
        .status(404)
        .end();
    }

    // ==========================
    // SVG
    // ==========================

    if (
      contentType.includes("svg") ||
      imageUrl.toLowerCase().includes(".svg")
    ) {

      const png =
        await sharp(buffer)
          .png()
          .toBuffer();

      console.log(
        "✅ SVG CONVERTIDO A PNG"
      );

      res.set("Content-Type", "image/png");
      return res.send(png);
    }

    // ==========================
    // PNG / JPG / WEBP
    // ==========================

    console.log(
      "✅ LOGO VALIDADO"
    );

    res.set(
      "Content-Type",
      contentType ||
      "image/png"
    );

    return res.send(
      buffer
    );

  }

  catch (error) {

    console.log(
      "❌ ERROR LOGO:",
      error.response?.status ||
      error.message
    );

    // Si la URL devuelve 404, devolver 404 al cliente
    if (error.response?.status === 404) {
      return res
        .status(404)
        .end();
    }

    return res
      .status(500)
      .send(
        "Error cargando imagen"
      );
  }

});

module.exports = router;