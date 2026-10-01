const assert = require("assert");
const path = require("path");
const { scoreMatch, findMatches } = require("../src/matcher");
const { gaugeCompatibility } = require("../src/deduplicator");
const { normalizePattern, normalizeYarn, validateYarn } = require("../src/schema");
const { importCatalog } = require("../src/importer");

const yarn = normalizeYarn({
  id: "test-wool", brand: "Test", name: "Wool", weight: "Worsted", fiber: ["wool"],
  stitchesPer4Inches: 18, strands: 1,
  availability: { status: "unknown", checkedAt: null, url: null }
}, "test");
const pattern = normalizePattern({
  id: "test-pattern", title: "Test", craft: "knitting", yarnWeight: "worsted",
  fiberTypes: ["wool"], strandCount: 1, gauge: { stitches: 18, rows: 24 }
}, "test");

assert.strictEqual(yarn.stitchesPer4Inches.min, 18);
assert.strictEqual(pattern.gauge.stitches.max, 18);
assert.strictEqual(scoreMatch(yarn, pattern).score, 100);
assert(scoreMatch({ ...yarn, weight: "sport" }, pattern).score < 100);
assert(scoreMatch({ ...yarn, fiber: ["cotton"] }, pattern).score < 100);
assert(scoreMatch({ ...yarn, strands: 2 }, pattern).score < 100);
assert.strictEqual(gaugeCompatibility({ stitches: 18 }, { stitches: { min: 16, max: 20 } }), 100);
assert.strictEqual(validateYarn({ ...yarn, availability: { status: "in-stock" } }).length, 2);
const imported = importCatalog(path.join(__dirname, "../data/yarnspirations.sample.json"));
assert(imported.valid);
assert.strictEqual(findMatches([yarn], pattern)[0].match.score, 100);
console.log("All tests passed");
