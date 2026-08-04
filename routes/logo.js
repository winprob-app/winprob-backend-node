const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");

const router = express.Router();

const LOGOS_FOLDER = path.join(
  __dirname,
  "..",
  "logos",
  "teams"
);

fs.ensureDirSync(LOGOS_FOLDER);

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

router.get("/", async (req, res) => {

  try {

    const teamId = req.query.teamId;

    let imageUrl = req.query.url;

    if (teamId && teamLogoMap[teamId]) {
      imageUrl =
        `https://football-logos.cc/logos/${teamLogoMap[teamId]}.png`;
    }

    if (!imageUrl) {
      return res.status(400).send("URL requerida");
    }

    const fileName =
      path.basename(imageUrl).replace(".svg", ".png");

    const localPath = path.join(
      LOGOS_FOLDER,
      fileName,
    );

    if (await fs.pathExists(localPath)) {
      return res.sendFile(localPath);
    }

    const response = await axios.get(
      imageUrl,
      {
        responseType: "arraybuffer"
      }
    );

    const contentType =
      response.headers["content-type"] || "";

    if (contentType.includes("png")) {

      await fs.writeFile(
        localPath,
        response.data
      );

      return res.sendFile(localPath);

    }

    if (contentType.includes("svg")) {

      const png = await sharp(response.data)
        .png()
        .toBuffer();

      await fs.writeFile(
        localPath,
        png
      );

      return res.sendFile(localPath);

    }

    res.set(
      "Content-Type",
      contentType
    );

    res.send(response.data);

  }

  catch (error) {

    console.log(
      "ERROR LOGO:",
      error.message
    );

    res.status(500).send(
      "Error cargando imagen"
    );

  }

});

module.exports = router;