const express = require("express");
const router = express.Router();
const axios = require("axios");
const { supabase } = require("../index");

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const DATE_LINE_REGEX = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(\d{4}))?$/;
const MATCH_LINE_REGEX = /^(\d{1,2}:\d{2})?\s*(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(?:\s*\([^)]*\))?$/;
const NEW_FORMAT_TIME_REGEX = /^\d{1,2}:\d{2}$/;
const NEW_FORMAT_SCORE_REGEX = /^(\d+)-(\d+)/;

function parseFootballTxt(text, defaultYear) {
  const lines = text.split("\n");
  const matches = [];
  let currentDate = null;
  let lastTime = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("=") ||
      line.startsWith("#") ||
      line.startsWith("▪") ||
      line.startsWith("(")
    ) {
      continue;
    }

    const dateMatch = line.match(DATE_LINE_REGEX);
    if (dateMatch) {
      const [, , monthStr, dayStr, yearStr] = dateMatch;
      const year = yearStr ? parseInt(yearStr) : defaultYear;
      currentDate = new Date(Date.UTC(year, MONTHS[monthStr], parseInt(dayStr)));
      lastTime = null;
      continue;
    }

    if (!currentDate) continue;

    // Formato nuevo: "18:30   Equipo1  2-0 (1-0)  Equipo2"
    const tokens = line.split(/\s{2,}/).map((t) => t.trim()).filter(Boolean);
    if (
      tokens.length >= 4 &&
      NEW_FORMAT_TIME_REGEX.test(tokens[0]) &&
      NEW_FORMAT_SCORE_REGEX.test(tokens[2])
    ) {
      const scoreMatch = tokens[2].match(NEW_FORMAT_SCORE_REGEX);
      lastTime = tokens[0];

      matches.push({
        date: currentDate,
        time: tokens[0],
        team1: tokens[1],
        team2: tokens[3],
        homeScore: parseInt(scoreMatch[1]),
        awayScore: parseInt(scoreMatch[2]),
      });
      continue;
    }

    // Formato viejo: "18:30  Equipo1 v Equipo2  2-0 (1-0)"
    const matchLine = line.match(MATCH_LINE_REGEX);
    if (matchLine) {
      const [, time, team1, team2, homeScore, awayScore] = matchLine;
      if (time) lastTime = time;

      matches.push({
        date: currentDate,
        time: lastTime || "00:00",
        team1: team1.trim(),
        team2: team2.trim(),
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
      });
    }
  }

  return matches;
}

function stableId(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 910000000000 + Math.abs(hash);
}

const FILES = [
  { url: "https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2024_co1.txt", year: 2024, leagueName: "Categoria Primera A" },
  { url: "https://raw.githubusercontent.com/openfootball/south-america/master/colombia/2025_co1.txt", year: 2025, leagueName: "Categoria Primera A" },
  { url: "https://raw.githubusercontent.com/openfootball/south-america/master/brazil/2024_br1.txt", year: 2024, leagueName: "Campeonato Brasileiro Série A" },
  { url: "https://raw.githubusercontent.com/openfootball/south-america/master/brazil/2025_br1.txt", year: 2025, leagueName: "Campeonato Brasileiro Série A" },

  { url: "https://raw.githubusercontent.com/openfootball/england/master/2024-25/1-premierleague.txt", year: 2024, leagueName: "Premier League" },
  { url: "https://raw.githubusercontent.com/openfootball/england/master/2025-26/1-premierleague.txt", year: 2025, leagueName: "Premier League" },
  { url: "https://raw.githubusercontent.com/openfootball/england/master/2024-25/2-championship.txt", year: 2024, leagueName: "Championship" },
  { url: "https://raw.githubusercontent.com/openfootball/england/master/2025-26/2-championship.txt", year: 2025, leagueName: "Championship" },

  { url: "https://raw.githubusercontent.com/openfootball/italy/master/2024-25/1-seriea.txt", year: 2024, leagueName: "Serie A" },
  { url: "https://raw.githubusercontent.com/openfootball/italy/master/2025-26/1-seriea.txt", year: 2025, leagueName: "Serie A" },

  { url: "https://raw.githubusercontent.com/openfootball/europe/master/france/2024-25_fr1.txt", year: 2024, leagueName: "Ligue 1" },
  { url: "https://raw.githubusercontent.com/openfootball/europe/master/france/2025-26_fr1.txt", year: 2025, leagueName: "Ligue 1" },

];


router.get("/", async (req, res) => {
  try {
    let totalImportados = 0;

    for (const file of FILES) {
      console.log(`⬇️ Descargando: ${file.leagueName} ${file.year}`);

      let text;
      try {
        const response = await axios.get(file.url);
        text = response.data;
      } catch (error) {
        console.error(`❌ ERROR DESCARGANDO ${file.leagueName} ${file.year}:`, error.message);
        continue;
      }

      const parsedMatches = parseFootballTxt(text, file.year);
      console.log(`📋 ${file.leagueName} ${file.year}: ${parsedMatches.length} partidos detectados`);

      const rowsToInsert = parsedMatches.map((match) => {
        const [hh, mm] = match.time.split(":").map(Number);
        const fixtureDate = new Date(match.date);
        fixtureDate.setUTCHours(hh, mm, 0, 0);

        const sourceMatchId = `${fixtureDate.toISOString()}_${match.team1}_${match.team2}`;

        return {
          id: stableId(sourceMatchId),
          league_id: null,
          league_name: file.leagueName,
          fixture_date: fixtureDate.toISOString(),
          status: "FT",
          home_team_id: null,
          home_team_name: match.team1,
          away_team_id: null,
          away_team_name: match.team2,
          home_score: match.homeScore,
          away_score: match.awayScore,
          source: "openfootball",
          source_match_id: sourceMatchId,
        };
      });

      if (rowsToInsert.length > 0) {
        const { error } = await supabase
          .from("matches")
          .upsert(rowsToInsert, { onConflict: "source,source_match_id" });

        if (error) {
          console.error(`❌ ERROR GUARDANDO ${file.leagueName} ${file.year}:`, error.message);
        } else {
          console.log(`✅ ${file.leagueName} ${file.year}: ${rowsToInsert.length} partidos guardados`);
          totalImportados += rowsToInsert.length;
        }
      }
    }

    res.json({ mensaje: "Importación completa", partidosImportados: totalImportados });

  } catch (error) {
    console.error("❌ ERROR EN IMPORTACIÓN SUDAMÉRICA:", error.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;