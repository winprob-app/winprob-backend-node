require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { getDisplayTeamName } = require("../services/teamAliases");
const K = 6;
const RHO = -0.10;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PAGE_SIZE = 1000;
const HISTORY_WINDOW = 20;
const MIN_PREVIOUS_MATCHES = 5;
const MAX_GOALS = 8;
const EPSILON = 1e-15;

function isFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number);
}

function toScore(value) {
  return isFiniteNumber(value) ? Number(value) : null;
}

function poissonProbability(lambda, goals) {
  let factorial = 1;
  for (let value = 2; value <= goals; value++) {
    factorial *= value;
  }
  return Math.exp(-lambda) * Math.pow(lambda, goals) / factorial;
}

function average(history, field) {
  return history.reduce((total, match) => total + match[field], 0) / history.length;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function predict(homeHistory, awayHistory, muHome, muAway) {
  const homeRecent = homeHistory.slice(-HISTORY_WINDOW);
  const awayRecent = awayHistory.slice(-HISTORY_WINDOW);

  const mu = (muHome + muAway) / 2;
  const homeAttack =
    (homeRecent.reduce((total, match) => total + match.for, 0) + K * mu) /
    (homeRecent.length + K);
  const homeDefence =
    (homeRecent.reduce((total, match) => total + match.against, 0) + K * mu) /
    (homeRecent.length + K);
  const awayAttack =
    (awayRecent.reduce((total, match) => total + match.for, 0) + K * mu) /
    (awayRecent.length + K);
  const awayDefence =
    (awayRecent.reduce((total, match) => total + match.against, 0) + K * mu) /
    (awayRecent.length + K);

  let lambdaHome =
    homeAttack * awayDefence / mu * (muHome / mu);
  let lambdaAway = awayAttack * homeDefence / mu * (muAway / mu);

  lambdaHome = clamp(lambdaHome, 0.3, 4.0);
  lambdaAway = clamp(lambdaAway, 0.3, 4.0);

  const homeProbabilities = Array.from({ length: MAX_GOALS + 1 }, (_, goals) =>
    poissonProbability(lambdaHome, goals)
  );
  const awayProbabilities = Array.from({ length: MAX_GOALS + 1 }, (_, goals) =>
    poissonProbability(lambdaAway, goals)
  );

  const matrix = [];
  let totalProbability = 0;

  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
      let probability = homeProbabilities[homeGoals] * awayProbabilities[awayGoals];
      if (homeGoals === 0 && awayGoals === 0) {
        probability *= 1 - lambdaHome * lambdaAway * RHO;
      } else if (homeGoals === 0 && awayGoals === 1) {
        probability *= 1 + lambdaHome * RHO;
      } else if (homeGoals === 1 && awayGoals === 0) {
        probability *= 1 + lambdaAway * RHO;
      } else if (homeGoals === 1 && awayGoals === 1) {
        probability *= 1 - RHO;
      }
      matrix.push({ homeGoals, awayGoals, probability });
      totalProbability += probability;
    }
  }

  let homeProbability = 0;
  let drawProbability = 0;
  let awayProbability = 0;
  let predictedHomeGoals = 0;
  let predictedAwayGoals = 0;
  let highestScoreProbability = -1;

  for (const score of matrix) {
    const probability = score.probability / totalProbability;
    if (score.homeGoals > score.awayGoals) {
      homeProbability += probability;
    } else if (score.homeGoals === score.awayGoals) {
      drawProbability += probability;
    } else {
      awayProbability += probability;
    }

    if (probability > highestScoreProbability) {
      highestScoreProbability = probability;
      predictedHomeGoals = score.homeGoals;
      predictedAwayGoals = score.awayGoals;
    }
  }

  return {
    home: homeProbability,
    draw: drawProbability,
    away: 1 - homeProbability - drawProbability,
    predictedHomeGoals,
    predictedAwayGoals,
    lambdaHome,
    lambdaAway,
  };
}

async function readFinishedMatches() {
  const matches = [];
  let from = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "FT")
      .order("fixture_date")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!page || page.length === 0) break;

    matches.push(...page);
    from += PAGE_SIZE;

    if (page.length < PAGE_SIZE) break;
  }

  return matches.filter((match) => {
    const homeScore = toScore(match.home_score);
    const awayScore = toScore(match.away_score);
    return (
      match.fixture_date &&
      isFiniteNumber(homeScore) &&
      isFiniteNumber(awayScore)
    );
  });
}

function emptyMetrics() {
  return {
    evaluated: 0,
    correct: 0,
    brier: 0,
    logLoss: 0,
    alwaysHomeCorrect: 0,
    alwaysHomeBrier: 0,
    alwaysHomeLogLoss: 0,
    historicalCorrect: 0,
    historicalBrier: 0,
    historicalLogLoss: 0,
    predictedDrawTotal: 0,
    actualDraws: 0,
    predictedGoalsTotal: 0,
    actualGoalsTotal: 0,
    calibration: Array.from({ length: 10 }, () => ({
      count: 0,
      predictedTotal: 0,
      homeWins: 0,
    })),
    leagues: new Map(),
  };
}

function classIndex(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 0;
  if (homeGoals === awayGoals) return 1;
  return 2;
}

function classProbability(prediction, index) {
  return [prediction.home, prediction.draw, prediction.away][index];
}

function updateReferenceMetrics(metrics, probabilities, actual, reference) {
  const actualProbability = reference[actual];
  metrics["brier"] += probabilities.reduce(
    (total, probability, index) =>
      total + Math.pow(probability - (index === actual ? 1 : 0), 2),
    0
  );
  metrics["logLoss"] -= Math.log(Math.max(actualProbability, EPSILON));
}

function addLeagueResult(metrics, leagueName, prediction, actual) {
  const league = leagueName || "Sin liga";
  if (!metrics.leagues.has(league)) {
    metrics.leagues.set(league, { evaluated: 0, correct: 0 });
  }

  const stats = metrics.leagues.get(league);
  stats.evaluated++;
  if (prediction === actual) stats.correct++;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function printSummary(metrics) {
  const evaluated = metrics.evaluated;
  const divisor = evaluated || 1;
  const actualDrawRate = metrics.actualDraws / divisor;
  const predictedDrawRate = metrics.predictedDrawTotal / divisor;
  const averagePredictedGoals = metrics.predictedGoalsTotal / divisor;
  const averageActualGoals = metrics.actualGoalsTotal / divisor;

  console.log("\n========== BACKTEST ==========");
  console.log(`Partidos evaluados: ${evaluated}`);
  console.log(`Acierto: ${formatPercent(metrics.correct / divisor)}`);
  console.log(`Brier score: ${(metrics.brier / divisor).toFixed(6)}`);
  console.log(`Log loss: ${(metrics.logLoss / divisor).toFixed(6)}`);
  console.log("\nReferencias:");
  console.log(`Siempre local - acierto: ${formatPercent(metrics.alwaysHomeCorrect / divisor)}, Brier: ${(metrics.alwaysHomeBrier / divisor).toFixed(6)}`);
  console.log(`Frecuencia histórica - acierto: ${formatPercent(metrics.historicalCorrect / divisor)}, Brier: ${(metrics.historicalBrier / divisor).toFixed(6)}`);
  console.log(`\nEmpate: predicho ${formatPercent(predictedDrawRate)} vs real ${formatPercent(actualDrawRate)}`);
  console.log(`Goles: lambda promedio ${(averagePredictedGoals).toFixed(3)} vs real ${(averageActualGoals).toFixed(3)}`);

  console.log("\nCalibración del local:");
  metrics.calibration.forEach((bucket, index) => {
    const lower = index * 10;
    const upper = index === 9 ? 100 : lower + 10;
    const averagePrediction = bucket.count ? bucket.predictedTotal / bucket.count : 0;
    const actualHomeRate = bucket.count ? bucket.homeWins / bucket.count : 0;
    console.log(
      `${lower}-${upper}%: n=${bucket.count}, pred=${formatPercent(averagePrediction)}, real=${formatPercent(actualHomeRate)}`
    );
  });

  console.log("\nAcierto por liga (top 8):");
  [...metrics.leagues.entries()]
    .sort(([, first], [, second]) => second.evaluated - first.evaluated)
    .slice(0, 8)
    .forEach(([league, stats]) => {
      console.log(
        `${league}: n=${stats.evaluated}, acierto=${formatPercent(stats.correct / stats.evaluated)}`
      );
    });
}

async function main() {
  try {
    const matches = await readFinishedMatches();
    const histories = new Map();
    const leagueGoals = new Map();
    const metrics = emptyMetrics();
    const historicalCounts = [0, 0, 0];
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;
    let totalMatches = 0;

    for (const match of matches) {
      const homeName = getDisplayTeamName(match.home_team_name);
      const awayName = getDisplayTeamName(match.away_team_name);
      if (!homeName || !awayName) continue;

      const leagueName = match.league_name || "Sin liga";
      const leagueTotals = leagueGoals.get(leagueName) || {
        homeGoals: 0,
        awayGoals: 0,
        matches: 0,
      };
      const homeHistory = histories.get(homeName) || [];
      const awayHistory = histories.get(awayName) || [];
      if (
        homeHistory.length >= MIN_PREVIOUS_MATCHES &&
        awayHistory.length >= MIN_PREVIOUS_MATCHES
      ) {
        const muHome = leagueTotals.matches > 0
          ? leagueTotals.homeGoals / leagueTotals.matches
          : 1.30;
        const muAway = leagueTotals.matches > 0
          ? leagueTotals.awayGoals / leagueTotals.matches
          : 1.30;
        const prediction = predict(homeHistory, awayHistory, muHome, muAway);
        const homeGoals = toScore(match.home_score);
        const awayGoals = toScore(match.away_score);
        const actual = classIndex(homeGoals, awayGoals);
        const probabilities = [prediction.home, prediction.draw, prediction.away];

        metrics.evaluated++;
        if (probabilities.indexOf(Math.max(...probabilities)) === actual) {
          metrics.correct++;
        }
        metrics.brier += probabilities.reduce(
          (total, probability, index) =>
            total + Math.pow(probability - (index === actual ? 1 : 0), 2),
          0
        );
        metrics.logLoss -= Math.log(Math.max(probabilities[actual], EPSILON));
        metrics.predictedDrawTotal += prediction.draw;
        if (actual === 1) metrics.actualDraws++;
        metrics.predictedGoalsTotal += prediction.lambdaHome + prediction.lambdaAway;
        metrics.actualGoalsTotal += homeGoals + awayGoals;

        if (actual === 0) metrics.alwaysHomeCorrect++;
        metrics.alwaysHomeBrier += Math.pow(1 - (actual === 0 ? 1 : 0), 2) +
          Math.pow(0 - (actual === 1 ? 1 : 0), 2) +
          Math.pow(0 - (actual === 2 ? 1 : 0), 2);

        const historicalTotal = historicalCounts.reduce((sum, count) => sum + count, 0);
        const historicalProbabilities = historicalTotal > 0
          ? historicalCounts.map((count) => count / historicalTotal)
          : [1 / 3, 1 / 3, 1 / 3];
        if (historicalProbabilities.indexOf(Math.max(...historicalProbabilities)) === actual) {
          metrics.historicalCorrect++;
        }
        metrics.historicalBrier += historicalProbabilities.reduce(
          (total, probability, index) =>
            total + Math.pow(probability - (index === actual ? 1 : 0), 2),
          0
        );
        metrics.historicalLogLoss -= Math.log(
          Math.max(historicalProbabilities[actual], EPSILON)
        );

        const bucket = Math.min(Math.floor(prediction.home * 10), 9);
        metrics.calibration[bucket].count++;
        metrics.calibration[bucket].predictedTotal += prediction.home;
        if (actual === 0) metrics.calibration[bucket].homeWins++;

        addLeagueResult(
          metrics,
          match.league_name,
          probabilities.indexOf(Math.max(...probabilities)),
          actual
        );
      }

      const homeGoals = toScore(match.home_score);
      const awayGoals = toScore(match.away_score);
      if (!histories.has(homeName)) histories.set(homeName, []);
      if (!histories.has(awayName)) histories.set(awayName, []);
      histories.get(homeName).push({ for: homeGoals, against: awayGoals });
      histories.get(awayName).push({ for: awayGoals, against: homeGoals });

      leagueTotals.homeGoals += homeGoals;
      leagueTotals.awayGoals += awayGoals;
      leagueTotals.matches++;
      leagueGoals.set(leagueName, leagueTotals);
      totalHomeGoals += homeGoals;
      totalAwayGoals += awayGoals;
      totalMatches++;

      historicalCounts[classIndex(homeGoals, awayGoals)]++;
    }

    printSummary(metrics);
    console.log(`muHome final: ${(totalHomeGoals / totalMatches).toFixed(3)}`);
    console.log(`muAway final: ${(totalAwayGoals / totalMatches).toFixed(3)}`);
  } catch (error) {
    console.error("❌ ERROR EN BACKTEST:", error.message);
    process.exitCode = 1;
  }
}

main();
