const WEIGHTS = ["lace", "fingering", "sport", "dk", "worsted", "aran", "bulky", "super-bulky", "jumbo"];

function midpoint(range) {
  if (typeof range === 'number') return range;
  if (!range) return 0;
  if (typeof range.min === 'number' && typeof range.max === 'number') {
    return (range.min + range.max) / 2;
  }
  return 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function gaugeScore(actual, target) {
  if (!actual || !target) return 50;
  return clamp(100 - (Math.abs(actual - target) / target) * 100);
}

function weightScore(actual, target) {
  const normActual = (actual || '').toLowerCase();
  const normTarget = (target || '').toLowerCase();
  const idxActual = WEIGHTS.indexOf(normActual);
  const idxTarget = WEIGHTS.indexOf(normTarget);
  if (idxActual === -1 || idxTarget === -1) return 50;
  const distance = Math.abs(idxActual - idxTarget);
  return clamp(100 - distance * 25);
}

/**
 * Categorize match quality into four tiers
 */
function getMatchQuality(score) {
  if (score >= 90) return 'Perfect';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Acceptable';
  return 'Poor';
}

/**
 * Score a yarn against a pattern. The pattern gauge is stitches per 4 inches.
 * This is a starting point, not a substitute for a swatch.
 */
function scoreMatch(yarn, pattern) {
  const gauge = midpoint(yarn.stitchesPer4Inches);
  const gaugeMatch = gaugeScore(gauge, pattern.stitchesPer4Inches);
  const weightMatch = weightScore(yarn.weight, pattern.weight);
  const fiberMatch = !pattern.fiber || (Array.isArray(yarn.fiber) ? yarn.fiber.includes(pattern.fiber) : yarn.fiber === pattern.fiber) ? 100 : 45;
  const strandMatch = yarn.strands === (pattern.strands || 1) ? 100 : 70;

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

/**
 * Yarn -> Patterns Matcher
 * Finds compatible patterns given user yarn specifications.
 */
function matchYarnToPatterns(yarnSpecs, patterns) {
  const scored = patterns.map(pattern => {
    // 1. Stitch gauge score
    const patternStitches = typeof pattern.gauge?.stitches === 'number'
      ? pattern.gauge.stitches
      : midpoint(pattern.gauge?.stitches);
    const stitchMatch = gaugeScore(yarnSpecs.stitchesPer4Inches, patternStitches);

    // 2. Row gauge score (if provided)
    let gaugeMatch = stitchMatch;
    if (yarnSpecs.rowsPer4Inches && pattern.gauge?.rows) {
      const patternRows = typeof pattern.gauge.rows === 'number'
        ? pattern.gauge.rows
        : midpoint(pattern.gauge.rows);
      const rowMatch = gaugeScore(yarnSpecs.rowsPer4Inches, patternRows);
      gaugeMatch = Math.round(stitchMatch * 0.75 + rowMatch * 0.25);
    } else {
      gaugeMatch = Math.round(stitchMatch);
    }

    // 3. Yarn weight score
    const weightMatch = Math.round(weightScore(yarnSpecs.weight, pattern.yarnWeight));

    // 4. Yardage match
    let yardageMatch = 100;
    if (yarnSpecs.totalYardage != null && pattern.yardageRequired) {
      if (yarnSpecs.totalYardage >= pattern.yardageRequired) {
        yardageMatch = 100;
      } else {
        yardageMatch = clamp(Math.round((yarnSpecs.totalYardage / pattern.yardageRequired) * 100));
      }
    }

    // 5. Fiber match
    let fiberMatch = 100;
    if (yarnSpecs.fiber) {
      const normFiber = yarnSpecs.fiber.toLowerCase().trim();
      const patternFibers = (pattern.fiberTypes || []).map(f => f.toLowerCase());
      const hasMatch = patternFibers.some(f => f.includes(normFiber) || normFiber.includes(f));
      fiberMatch = hasMatch ? 100 : 50;
    }

    // Weighted composite score
    const score = clamp(
      Math.round(gaugeMatch * 0.40 + weightMatch * 0.25 + yardageMatch * 0.20 + fiberMatch * 0.15),
      0,
      100
    );

    // Build recommendations
    let recommendation = '';
    if (yarnSpecs.totalYardage != null && yarnSpecs.totalYardage < pattern.yardageRequired) {
      recommendation = `Insufficient yardage: requires ${pattern.yardageRequired} yds (have ${yarnSpecs.totalYardage} yds). Extra skeins needed!`;
    } else if (score >= 90) {
      recommendation = 'Great match! Swatch to confirm gauge before starting.';
    } else if (score >= 70) {
      recommendation = 'Good match. Swatch carefully; needle/hook adjustment may be needed.';
    } else if (score >= 50) {
      recommendation = 'Acceptable match. Swatch carefully for this substitution; gauge or weight differs.';
    } else {
      recommendation = 'Poor match: significant gauge/weight variance from pattern.';
    }

    if (pattern.yarnWeight && yarnSpecs.weight && pattern.yarnWeight.toLowerCase() !== yarnSpecs.weight.toLowerCase()) {
      recommendation += ` (Weight: yarn is ${yarnSpecs.weight}, pattern calls for ${pattern.yarnWeight})`;
    }

    return {
      id: pattern.id,
      title: pattern.title,
      designer: pattern.designer || 'Unknown',
      difficulty: pattern.difficulty || 'N/A',
      yardageRequired: pattern.yardageRequired != null ? pattern.yardageRequired : 'N/A',
      craft: pattern.craft || 'N/A',
      yarnWeight: pattern.yarnWeight || 'N/A',
      gaugeMatch,
      weightMatch,
      yardageMatch,
      fiberMatch,
      score,
      quality: getMatchQuality(score),
      recommendation
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Reverse Matcher: Pattern -> Yarns Matcher
 * Finds compatible yarns from catalog given user pattern requirements.
 */
function matchPatternToYarns(patternSpecs, yarns) {
  const options = yarns.flatMap(yarn => {
    const list = [yarn];
    if (yarn.strands === 1) {
      list.push({
        ...yarn,
        id: `${yarn.id}-held-double`,
        name: `${yarn.name} (held double)`,
        strands: 2,
        stitchesPer4Inches: {
          min: yarn.stitchesPer4Inches.min * 0.65,
          max: yarn.stitchesPer4Inches.max * 0.75
        }
      });
    }
    return list;
  });

  const scored = options.map(yarn => {
    // 1. Gauge match
    const yarnGauge = midpoint(yarn.stitchesPer4Inches);
    const gaugeMatch = Math.round(gaugeScore(yarnGauge, patternSpecs.stitchesPer4Inches));

    // 2. Weight match
    let weightMatch;
    if (yarn.strands === 1) {
      weightMatch = Math.round(weightScore(yarn.weight, patternSpecs.weight));
    } else {
      const yarnIdx = WEIGHTS.indexOf((yarn.weight || '').toLowerCase());
      const effectiveWeight = yarnIdx !== -1 ? WEIGHTS[Math.min(WEIGHTS.length - 1, yarnIdx + 2)] : yarn.weight;
      weightMatch = Math.round(weightScore(effectiveWeight, patternSpecs.weight));
    }

    // 3. Fiber match
    let fiberMatch = 100;
    if (patternSpecs.fiber) {
      const normFiber = patternSpecs.fiber.toLowerCase().trim();
      const yarnFibers = (yarn.fiber || []).map(f => f.toLowerCase());
      const hasMatch = yarnFibers.some(f => f.includes(normFiber) || normFiber.includes(f));
      fiberMatch = hasMatch ? 100 : 50;
    }

    // 4. Category-specific fiber compatibility check
    let categoryNote = '';
    const category = (patternSpecs.category || '').toLowerCase();
    if (category.includes('dishcloth') && !(yarn.fiber || []).some(f => f.toLowerCase().includes('cotton'))) {
      categoryNote = ' (Note: Cotton is recommended for dishcloths)';
    }

    // 5. Strand compatibility factor
    const strandFactor = yarn.strands === 1 ? 100 : 80;

    // Weighted composite score
    const score = clamp(
      Math.round(gaugeMatch * 0.50 + weightMatch * 0.25 + fiberMatch * 0.15 + (strandFactor === 100 ? 10 : 8)),
      0,
      100
    );

    // 6. Yardage / Skein calculation
    let skeinsNeeded = null;
    if (yarn.yardagePer100g && patternSpecs.yardageNeeded) {
      const strandMultiplier = yarn.strands === 2 ? 2 : 1;
      const totalYardsNeeded = patternSpecs.yardageNeeded * strandMultiplier;
      skeinsNeeded = Math.ceil(totalYardsNeeded / yarn.yardagePer100g);
    }

    // 7. Recommendation
    let recommendation = '';
    if (yarn.strands === 2) {
      recommendation = 'Double strand: swatch carefully; drape and yardage consumption will change.';
    } else if (score >= 90) {
      recommendation = 'Great match! Swatch to confirm gauge before starting.';
    } else if (score >= 70) {
      recommendation = 'Good match. Swatch carefully for this substitution.';
    } else if (score >= 50) {
      recommendation = 'Acceptable match. Swatch carefully; gauge or weight differs somewhat.';
    } else {
      recommendation = 'Poor match: significant gauge or weight difference from pattern.';
    }

    if (categoryNote) {
      recommendation += categoryNote;
    }

    return {
      id: yarn.id,
      brand: yarn.brand,
      name: yarn.name,
      strands: yarn.strands,
      weight: yarn.weight,
      fiber: Array.isArray(yarn.fiber) ? yarn.fiber.join(', ') : yarn.fiber,
      availability: yarn.availability?.status || 'unknown',
      price: yarn.price != null ? `$${yarn.price}` : 'N/A',
      skeinsNeeded,
      gaugeMatch,
      weightMatch,
      fiberMatch,
      score,
      quality: getMatchQuality(score),
      recommendation
    };
  });

  return scored.sort((a, b) => b.score - a.score);
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

module.exports = {
  WEIGHTS,
  midpoint,
  clamp,
  gaugeScore,
  weightScore,
  scoreMatch,
  findMatches,
  getMatchQuality,
  matchYarnToPatterns,
  matchPatternToYarns
};
