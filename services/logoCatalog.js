const fs = require("fs");
const path = require("path");

const CATALOG_ROOT = path.join(__dirname, "..", "assets", "logos");
const TEAM_LOGOS_ROOT = path.join(CATALOG_ROOT, "teams");
const LEAGUE_LOGOS_ROOT = path.join(CATALOG_ROOT, "leagues");

const pendingTeams = [
  "Alianza Petrolera",
  "Deportiva Once Caldas",
  "Internacional de Bogotá",
  "Llaneros FC",
  "Deportes Quindío",
  "Real Soacha Cundinamarca"
];

const pendingLeagues = [
  "Categoria Primera A",
  "Colombia Primera B",
  "Colombia Copa Cup"
];

function normalizeLogoName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getCatalogLogo(name, type) {
  const normalizedName = normalizeLogoName(name);
  const root = type === "team"
    ? TEAM_LOGOS_ROOT
    : LEAGUE_LOGOS_ROOT;
  const fileName = `${normalizedName.replace(/[^a-z0-9]+/g, "-")}.png`;

  if (!normalizedName || !fs.existsSync(path.join(root, fileName))) {
    return "";
  }

  return `/logo/${type}/${fileName}`;
}

function getLocalTeamLogo(teamName) {
  return getCatalogLogo(teamName, "team");
}

function getLocalLeagueLogo(leagueName) {
  return getCatalogLogo(leagueName, "league");
}

module.exports = {
  CATALOG_ROOT,
  TEAM_LOGOS_ROOT,
  LEAGUE_LOGOS_ROOT,
  pendingTeams,
  pendingLeagues,
  normalizeLogoName,
  getLocalTeamLogo,
  getLocalLeagueLogo
};
