const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// ==========================
// CONFIGURACIÓN
// ==========================

const API_KEY = process.env.ISPORTS_API_KEY;
const API_BASE = "https://api.isportsapi.com";

const LOGOS_FOLDER = path.join(
  __dirname,
  "..",
  "logos",
  "isports"
);

fs.ensureDirSync(LOGOS_FOLDER);

// ==========================
// CACHÉ DE RESULTADOS
// ==========================

const teamLogoCache = new Map();
const leagueLogoCache = new Map();

// ==========================
// CACHÉ DE PETICIONES EN CURSO
// ==========================

const teamLogoPending = new Map();
const leagueLogoPending = new Map();

// ==========================
// CONTROL DE CONCURRENCIA
// ==========================

const MAX_CONCURRENT = 4;
let activeRequests = 0;
const requestQueue = [];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function enqueueRequest(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    drainQueue();
  });
}

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
    const next = requestQueue.shift();
    activeRequests += 1;

    next.task()
      .then(next.resolve)
      .catch(next.reject)
      .finally(() => {
        activeRequests -= 1;
        drainQueue();
      });
  }
}

async function readCachedLogo(type, id) {
  const filePath = path.join(LOGOS_FOLDER, `${type}-${id}.json`);

  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  try {
    const cached = await fs.readJson(filePath);

    if (cached && typeof cached.logo !== "undefined") {
      return cached.logo;
    }
  } catch (error) {
    console.warn(`⚠️ ERROR LEYENDO CACHE ${type}: ${id}`);
  }

  return null;
}

async function writeCachedLogo(type, id, logo) {
  const filePath = path.join(LOGOS_FOLDER, `${type}-${id}.json`);

  await fs.writeJson(
    filePath,
    {
      id,
      logo: logo || "",
      updatedAt: Date.now()
    },
    { spaces: 2 }
  );
}

async function requestLogoWithRetry({
  type,
  id,
  endpoint,
  queryKey,
  label,
  cacheMap,
  pendingMap
}) {
  const cacheKey = String(id);

  try {
    console.log(`🖼️ CONSULTANDO LOGO ${label} iSPORTS: ${cacheKey}`);

    const response = await axios.get(
      `${API_BASE}${endpoint}`,
      {
        params: {
          api_key: API_KEY,
          [queryKey]: cacheKey
        },
        timeout: 15000
      }
    );

    const data = response.data;

    if (data?.code === 2) {
      console.log(`⏳ RATE LIMIT iSPORTS ${label}: ${cacheKey} - FALLBACK RÁPIDO`);
      // NO reintentar con esperas largas cuando hay rate limit
      // Devolver vacío rápidamente para permitir fallback
      return "";
    }

    if (data && data.code === 0 && data.data) {
      const item = Array.isArray(data.data)
        ? data.data[0]
        : data.data;

      const logo = item?.logo || "";

      if (logo) {
        cacheMap.set(cacheKey, logo);
        await writeCachedLogo(type, cacheKey, logo);
        console.log(`✅ LOGO ${label} iSPORTS ENCONTRADO: ${cacheKey}`);
        return logo;
      }

      console.log(`⚠️ LOGO ${label} NO DISPONIBLE: ${cacheKey}`);
      cacheMap.set(cacheKey, "");
      await writeCachedLogo(type, cacheKey, "");
      return "";
    }

    console.log(`⚠️ LOGO ${label} NO DISPONIBLE: ${cacheKey}`);
    return "";

  } catch (error) {
    console.error(
      `❌ ERROR LOGO ${label}: ${cacheKey}:`,
      error.response?.data || error.message
    );
    // Devolver vacío rápidamente sin reintentar en caso de error
    return "";
  }
}

async function fetchLogo({
  type,
  id,
  endpoint,
  queryKey,
  cacheMap,
  pendingMap,
  label
}) {
  if (!id) {
    return "";
  }

  const cacheKey = String(id);

  if (cacheMap.has(cacheKey)) {
    console.log(`📦 CACHE LOGO ${label} iSPORTS: ${cacheKey}`);
    return cacheMap.get(cacheKey);
  }

  const cachedFromDisk = await readCachedLogo(type, cacheKey);

  if (cachedFromDisk !== null) {
    cacheMap.set(cacheKey, cachedFromDisk);
    console.log(`📦 CACHE LOGO ${label} iSPORTS: ${cacheKey}`);
    return cachedFromDisk;
  }

  if (pendingMap.has(cacheKey)) {
    console.log(`⏳ CONSULTA LOGO ${label} YA EN CURSO: ${cacheKey}`);
    return pendingMap.get(cacheKey);
  }

  const request = enqueueRequest(async () => {
    try {
      return await requestLogoWithRetry({
        type,
        id: cacheKey,
        endpoint,
        queryKey,
        label,
        cacheMap,
        pendingMap
      });
    } finally {
      pendingMap.delete(cacheKey);
    }
  });

  pendingMap.set(cacheKey, request);

  return request;
}

// ==========================
// LOGO DE EQUIPO
// ==========================

async function getTeamLogo(teamId) {
  return fetchLogo({
    type: "team",
    id: teamId,
    endpoint: "/sport/football/team",
    queryKey: "teamId",
    cacheMap: teamLogoCache,
    pendingMap: teamLogoPending,
    label: "EQUIPO"
  });
}

// ==========================
// LOGO DE LIGA
// ==========================

async function getLeagueLogo(leagueId) {
  return fetchLogo({
    type: "league",
    id: leagueId,
    endpoint: "/sport/football/league",
    queryKey: "leagueId",
    cacheMap: leagueLogoCache,
    pendingMap: leagueLogoPending,
    label: "LIGA"
  });
}

module.exports = {
  getTeamLogo,
  getLeagueLogo
};