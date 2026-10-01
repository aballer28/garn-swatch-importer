const WEIGHTS = new Set(["lace", "fingering", "sport", "dk", "worsted", "aran", "bulky", "super-bulky", "jumbo"]);
const AVAILABILITY = new Set(["in-stock", "out-of-stock", "unknown"]);

function toRange(value, field) {
  if (typeof value === "number" && Number.isFinite(value)) return { min: value, max: value };
  if (
    value &&
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min <= value.max
  ) return { min: value.min, max: value.max };
  throw new Error(`${field} must be a number or a range with min <= max`);
}

function normalizeYarn(yarn, source = "unknown") {
  return {
    ...yarn,
    id: `${source}:${yarn.id}`,
    source,
    weight: String(yarn.weight).toLowerCase(),
    fiber: Array.isArray(yarn.fiber) ? yarn.fiber : [yarn.fiber],
    stitchesPer4Inches: toRange(yarn.stitchesPer4Inches, "stitchesPer4Inches"),
    availability: {
      status: yarn.availability?.status || "unknown",
      checkedAt: yarn.availability?.checkedAt ?? null,
      url: yarn.availability?.url ?? null
    }
  };
}

function normalizePattern(pattern, source = "unknown") {
  const gauge = pattern.gauge || {};
  return {
    ...pattern,
    id: `${source}:${pattern.id}`,
    source,
    yarnWeight: String(pattern.yarnWeight || pattern.weight).toLowerCase(),
    fiberTypes: pattern.fiberTypes || (pattern.fiber ? [pattern.fiber] : []),
    strandCount: pattern.strandCount || pattern.strands || 1,
    gauge: {
      ...gauge,
      stitches: toRange(gauge.stitches ?? pattern.stitchesPer4Inches, "gauge.stitches"),
      rows: gauge.rows == null ? null : toRange(gauge.rows, "gauge.rows")
    }
  };
}

function validateAvailability(availability, path, errors) {
  if (!AVAILABILITY.has(availability.status)) errors.push(`${path}.status must be in-stock, out-of-stock, or unknown`);
  if (availability.status !== "unknown") {
    if (!availability.checkedAt || Number.isNaN(Date.parse(availability.checkedAt))) {
      errors.push(`${path}.checkedAt is required for known inventory`);
    }
    if (!availability.url) errors.push(`${path}.url is required for known inventory`);
  }
}

function validateYarn(yarn) {
  const errors = [];
  if (!yarn.id || !yarn.name || !yarn.brand) errors.push("id, brand, and name are required");
  if (!WEIGHTS.has(yarn.weight)) errors.push("weight is not a supported yarn category");
  if (!Array.isArray(yarn.fiber) || yarn.fiber.length === 0) errors.push("fiber must be a non-empty array");
  try { toRange(yarn.stitchesPer4Inches, "stitchesPer4Inches"); } catch (error) { errors.push(error.message); }
  if (![1, 2].includes(yarn.strands)) errors.push("strands must be 1 or 2");
  validateAvailability(yarn.availability || {}, "availability", errors);
  return errors;
}

function validatePattern(pattern) {
  const errors = [];
  if (!pattern.id || !pattern.title) errors.push("id and title are required");
  if (!WEIGHTS.has(pattern.yarnWeight)) errors.push("yarnWeight is not a supported yarn category");
  if (!["knitting", "crochet"].includes(pattern.craft)) errors.push("craft must be knitting or crochet");
  if (!Array.isArray(pattern.fiberTypes)) errors.push("fiberTypes must be an array");
  try { toRange(pattern.gauge?.stitches, "gauge.stitches"); } catch (error) { errors.push(error.message); }
  if (![1, 2].includes(pattern.strandCount)) errors.push("strandCount must be 1 or 2");
  return errors;
}

module.exports = { toRange, normalizeYarn, normalizePattern, validateYarn, validatePattern };
