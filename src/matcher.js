const WEIGHTS = ["lace", "fingering", "sport", "dk", "worsted", "aran", "bulky", "super-bulky", "jumbo"];
const { toRange } = require("./schema");

function midpoint(range) {
  return (range.min + range.max) / 2;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function gaugeScore(actual, target) {
  if (!actual || !target) return 50;
  return clamp(100 - (Math.abs(actual - target) / target) * 100);
}

function weightScore(actual, target) {
  const distance = Math.abs(WEIGHTS.indexOf(actual) - WEIGHTS.indexOf(target));
  return distance < 0 ? 0 : clamp(100 - distance * 25);
}

/**
 * Score a yarn against a pattern. The pattern gauge is stitches per 4 inches.
 * This is a starting point, not a substitute for a swatch.
 */
function scoreMatch(yarn, pattern) {
  const gauge = midpoint(toRange(yarn.stitchesPer4Inches));
  const patternGauge = pattern.stitchesPer4Inches ?? pattern.gauge?.stitches;
  const gaugeMatch = gaugeScore(gauge, midpoint(toRange(patternGauge)));
  const patternWeight = pattern.weight || pattern.yarnWeight;
  const patternFibers = pattern.fiberTypes || (pattern.fiber ? [pattern.fiber] : []);
  const weightMatch = weightScore(yarn.weight, String(patternWeight).toLowerCase());
  const fiberMatch = !patternFibers.length || patternFibers.some((fiber) => yarn.fiber.includes(fiber)) ? 100 : 45;
  const targetStrands = pattern.strands || pattern.strandCount || 1;
  const strandMatch = yarn.strands === targetStrands ? 100 : 70;

  const score = Math.round(
    gaugeMatch * 0.55 + weightMatch * 0.2 + fiberMatch * 0.15 + strandMatch * 0.1
  );

  return {
    score,
    gaugeMatch: Math.round(gaugeMatch),
    recommendation:
      yarn.strands === 2
        ? "Double strand: swatch carefully; drape and yardage consumption will change."
        : "Single strand: compare the swatch to the pattern before starting."
  };
}

function findMatches(yarns, pattern) {
  return yarns
    .flatMap((yarn) => {
      const options = [yarn];
      if (yarn.strands === 1) {
        options.push({ ...yarn, id: `${yarn.id}-held-double`, name: `${yarn.name} held double`, strands: 2,
          stitchesPer4Inches: { min: yarn.stitchesPer4Inches.min * 0.65, max: yarn.stitchesPer4Inches.max * 0.75 } });
      }
      return options.map((option) => ({ yarn: option, match: scoreMatch(option, pattern) }));
    })
    .sort((a, b) => b.match.score - a.match.score);
}

if (require.main === module) {
  const catalog = require("../data/yarnspirations.sample.json");
  const pattern = { stitchesPer4Inches: 18, weight: "worsted", fiber: "acrylic", strands: 1 };
  console.table(findMatches(catalog.yarns, pattern).map(({ yarn, match }) => ({
    yarn: `${yarn.brand} ${yarn.name}`,
    strands: yarn.strands,
    score: match.score,
    gaugeMatch: match.gaugeMatch,
    availability: yarn.availability.status
  })));
}

module.exports = { findMatches, scoreMatch };
