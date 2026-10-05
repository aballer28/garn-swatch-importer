const assert = require('assert');
const { spawn } = require('child_process');
const { loadAllYarns, getAllBrands, loadUnifiedCatalog, loadPatterns } = require('../src/catalog');
const {
  getStitchGauge,
  gaugeCompatibility,
  deduplicatePatterns
} = require('../src/deduplicator');
const {
  WEIGHTS,
  midpoint,
  gaugeScore,
  weightScore,
  getMatchQuality,
  scoreMatch,
  findMatches,
  matchYarnToPatterns,
  matchPatternToYarns
} = require('../src/matcher');
const { normalizeWeight } = require('../src/cli');

console.log('Running tests...\n');

// 1. Catalog Loader Tests
console.log('1. Catalog Loader Tests:');
const yarns = loadAllYarns();
assert(Array.isArray(yarns), 'yarns should be an array');
assert(yarns.length > 0, 'should load yarns from catalog files');
console.log(`  ✓ Loaded ${yarns.length} yarns from unified catalog`);

const sampleYarn = yarns[0];
assert(sampleYarn.id, 'yarn should have an id');
assert(sampleYarn.brand, 'yarn should have a brand');
assert(sampleYarn.name, 'yarn should have a name');
assert(sampleYarn.weight, 'yarn should have a weight');
assert(Array.isArray(sampleYarn.fiber), 'yarn fiber should be an array');
assert(sampleYarn.stitchesPer4Inches, 'yarn should have stitchesPer4Inches');
assert('availability' in sampleYarn, 'yarn should have availability');
assert('price' in sampleYarn, 'yarn should have price property');
console.log('  ✓ Yarn records have all required normalized fields');

const brands = getAllBrands();
assert(Array.isArray(brands), 'brands should be an array');
assert(brands.length > 0, 'should return brands list');
assert(brands[0].brand && typeof brands[0].count === 'number', 'brands entries should have brand and count');
for (const brand of ['Kelbourne Woolens', 'Koigu', 'Knitting for Olive', 'Quince & Co.', 'Luca-S']) {
  const listing = brands.find(entry => entry.brand === brand);
  assert(listing, `${brand} should be listed in the catalog`);
  assert.strictEqual(listing.count, 0, `${brand} should not have unverified yarn records`);
}
console.log(`  ✓ getAllBrands returned ${brands.length} brands`);

const catalog = loadUnifiedCatalog();
assert.strictEqual(catalog.totalYarns, yarns.length, 'catalog totalYarns should match loaded yarns length');
console.log('  ✓ loadUnifiedCatalog returns complete catalog object');

const patterns = loadPatterns();
assert(Array.isArray(patterns), 'patterns should be an array');
assert(patterns.length > 0, 'should load patterns');
console.log(`  ✓ loadPatterns loaded ${patterns.length} deduplicated patterns`);

// 2. Deduplicator Gauge Compatibility Tests
console.log('\n2. Deduplicator Tests:');
assert.strictEqual(getStitchGauge({ stitches: 16 }), 16, 'getStitchGauge should handle number');
assert.strictEqual(getStitchGauge({ stitches: { min: 14, max: 18 } }), 16, 'getStitchGauge should handle range');
assert.strictEqual(getStitchGauge(null), null, 'getStitchGauge should handle null');

const compNum = gaugeCompatibility({ stitches: 16 }, { stitches: 16 });
assert.strictEqual(compNum, 100, 'gaugeCompatibility should return 100 for exact match');

const compRange = gaugeCompatibility({ stitches: { min: 15, max: 17 } }, { stitches: 16 });
assert.strictEqual(compRange, 100, 'gaugeCompatibility should handle range vs number');
console.log('  ✓ Gauge compatibility works with numeric and range gauge formats');

// 3. Matcher Tests
console.log('\n3. Matcher Tests:');
assert.strictEqual(midpoint(18), 18, 'midpoint should return number if number given');
assert.strictEqual(midpoint({ min: 16, max: 20 }), 18, 'midpoint should calculate midpoint of range');
assert.strictEqual(midpoint(null), 0, 'midpoint should handle null');

assert.strictEqual(gaugeScore(18, 18), 100, 'exact gauge score should be 100');
assert(gaugeScore(16, 18) < 100 && gaugeScore(16, 18) > 0, 'close gauge should have positive score < 100');

assert.strictEqual(weightScore('worsted', 'worsted'), 100, 'identical weight should score 100');
assert.strictEqual(weightScore('Worsted', 'WORSTED'), 100, 'weightScore should be case-insensitive');
assert.strictEqual(weightScore('DK', 'sport'), 75, 'adjacent weights should score 75');

assert.strictEqual(getMatchQuality(95), 'Perfect');
assert.strictEqual(getMatchQuality(80), 'Good');
assert.strictEqual(getMatchQuality(60), 'Acceptable');
assert.strictEqual(getMatchQuality(40), 'Poor');
console.log('  ✓ Helper functions (midpoint, gaugeScore, weightScore, getMatchQuality) pass');

// Existing matcher backward-compatibility test
const legacyMatch = scoreMatch(
  { stitchesPer4Inches: { min: 16, max: 20 }, weight: 'worsted', fiber: ['wool'], strands: 1 },
  { stitchesPer4Inches: 18, weight: 'worsted', fiber: 'acrylic', strands: 1 }
);
assert(legacyMatch.score > 0, 'legacy scoreMatch should work');
console.log(`  ✓ Existing scoreMatch backward-compatibility verified (score: ${legacyMatch.score})`);

// Yarn -> Patterns Matching Test
console.log('\n4. Yarn → Patterns Matching Tests:');
const yarnSpecs = {
  stitchesPer4Inches: 18,
  rowsPer4Inches: 24,
  weight: 'worsted',
  totalYardage: 1500,
  fiber: 'acrylic'
};
const patternMatches = matchYarnToPatterns(yarnSpecs, patterns);
assert(patternMatches.length > 0, 'should find pattern matches');
assert(patternMatches.length <= patterns.length, 'should match patterns');
// Sorted descending
for (let i = 0; i < patternMatches.length - 1; i++) {
  assert(patternMatches[i].score >= patternMatches[i + 1].score, 'results must be sorted by score descending');
}
const topPattern = patternMatches[0];
assert(topPattern.title, 'pattern match should have title');
assert(topPattern.designer, 'pattern match should have designer');
assert(topPattern.difficulty, 'pattern match should have difficulty');
assert(topPattern.yardageRequired != null, 'pattern match should have yardageRequired');
assert(topPattern.craft, 'pattern match should have craft');
assert(topPattern.score >= 0 && topPattern.score <= 100, 'score should be between 0 and 100');
assert(['Perfect', 'Good', 'Acceptable', 'Poor'].includes(topPattern.quality), 'quality should be valid tier');
assert(topPattern.recommendation, 'pattern match should include recommendation');
console.log(`  ✓ Yarn → Patterns matching returned ${patternMatches.length} sorted matches, top: "${topPattern.title}" (${topPattern.score}/100 - ${topPattern.quality})`);

// Pattern -> Yarns Reverse Matching Test
console.log('\n5. Pattern → Yarns (Reverse Matcher) Tests:');
const patternSpecs = {
  category: 'dishcloth',
  craft: 'crochet',
  stitchesPer4Inches: 18,
  rowsPer4Inches: 20,
  weight: 'sport',
  yardageNeeded: 150,
  fiber: 'cotton'
};
const yarnMatches = matchPatternToYarns(patternSpecs, yarns);
assert(yarnMatches.length > 0, 'should find yarn matches');
for (let i = 0; i < yarnMatches.length - 1; i++) {
  assert(yarnMatches[i].score >= yarnMatches[i + 1].score, 'yarn results must be sorted by score descending');
}
const topYarn = yarnMatches[0];
assert(topYarn.brand, 'yarn match should have brand');
assert(topYarn.name, 'yarn match should have name');
assert('availability' in topYarn, 'yarn match should have availability');
assert('price' in topYarn, 'yarn match should have price');
assert(topYarn.score >= 0 && topYarn.score <= 100, 'score should be between 0 and 100');
assert(['Perfect', 'Good', 'Acceptable', 'Poor'].includes(topYarn.quality), 'quality should be valid tier');
assert(topYarn.recommendation, 'yarn match should have recommendation');
console.log(`  ✓ Pattern → Yarns matching returned ${yarnMatches.length} sorted options, top: "${topYarn.brand} ${topYarn.name}" (${topYarn.score}/100 - ${topYarn.quality})`);

// Normalization & Validation Tests
console.log('\n6. CLI Input Validation Tests:');
assert.strictEqual(normalizeWeight('Worsted'), 'worsted');
assert.strictEqual(normalizeWeight('super bulky'), 'super-bulky');
assert.strictEqual(normalizeWeight('DK'), 'dk');
assert.strictEqual(normalizeWeight('not-a-weight'), null);
console.log('  ✓ normalizeWeight handles casing, spaces, and invalid weights');

// CLI End-to-End Execution Test
console.log('\n7. CLI Integration Test:');
function runCliWithInput(inputData) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/cli.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => stdout += chunk.toString());
    child.stderr.on('data', chunk => stderr += chunk.toString());

    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    child.stdin.write(inputData);
    child.stdin.end();
  });
}

(async () => {
  // Test Option 3 (View Brands), then Exit
  const resBrands = await runCliWithInput('3\n\n4\n');
  assert.strictEqual(resBrands.code, 0, 'CLI should exit with code 0');
  assert(resBrands.stdout.includes('Catalog Yarn Brands'), 'CLI output should contain brands table');
  assert(resBrands.stdout.includes('Big Twist'), 'CLI output should include Big Twist brand');
  console.log('  ✓ CLI: Option 3 (View All Brands) succeeded');

  // Test Option 1 (Yarn -> Patterns), then Exit
  const resOption1 = await runCliWithInput('1\n16\n12\nworsted\n1200\nacrylic\n\n4\n');
  assert.strictEqual(resOption1.code, 0, 'CLI should exit with code 0');
  assert(resOption1.stdout.includes('Yarn → Patterns Search'), 'CLI output should contain search header');
  assert(resOption1.stdout.includes('Top 10 matching patterns'), 'CLI output should contain top 10 patterns');
  assert(resOption1.stdout.includes('Perfect Matches') || resOption1.stdout.includes('Good Matches'), 'CLI output should group by quality');
  console.log('  ✓ CLI: Option 1 (Yarn → Patterns) succeeded');

  // Test Option 2 (Pattern -> Yarns), then Exit
  const resOption2 = await runCliWithInput('2\nsweater\nknitting\n18\n24\nworsted\n1500\nwool\n\n4\n');
  assert.strictEqual(resOption2.code, 0, 'CLI should exit with code 0');
  assert(resOption2.stdout.includes('Pattern → Yarns Search'), 'CLI output should contain search header');
  assert(resOption2.stdout.includes('Top 10 matching yarns'), 'CLI output should contain top 10 yarns');
  console.log('  ✓ CLI: Option 2 (Pattern → Yarns) succeeded');

  // Test Invalid input recovery, then Exit
  const resInvalid = await runCliWithInput('badchoice\n4\n');
  assert.strictEqual(resInvalid.code, 0, 'CLI should handle invalid choice gracefully and exit with 0');
  assert(resInvalid.stdout.includes('Invalid choice'), 'CLI output should warn on invalid input');
  console.log('  ✓ CLI: Gracefully handled invalid menu choices');

  console.log('\nAll tests passed successfully! 🎉\n');
})();
