const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  loadCatalogs,
  loadCatalog,
  loadPatterns,
  getYarnsByBrand,
  getPatternsByDifficulty,
  getAvailableBrands
} = require('../src/catalog-loader');

test('loadCatalog loads a single catalog by filename or path', () => {
  const catalog1 = loadCatalog('yarnspirations.sample.json');
  assert.ok(catalog1);
  assert.strictEqual(catalog1.source, 'Yarnspirations');
  assert.ok(Array.isArray(catalog1.yarns));
  assert.ok(catalog1.yarns.length > 0);

  const catalog2 = loadCatalog('data/yarnspirations.sample.json');
  assert.strictEqual(catalog2.source, 'Yarnspirations');

  assert.throws(() => {
    loadCatalog('non-existent-catalog.json');
  }, /not found/i);
});

test('loadPatterns loads and deduplicates default patterns', () => {
  const patterns = loadPatterns();
  assert.ok(Array.isArray(patterns));
  assert.strictEqual(patterns.length, 10);
  assert.strictEqual(patterns.duplicatesRemoved, 0);
  assert.ok(patterns.summary);
  assert.strictEqual(patterns.summary.original, 10);
});

test('loadPatterns correctly deduplicates duplicate patterns', () => {
  const sampleDuplicatePatterns = [
    {
      id: 'blanket-1',
      title: 'Easy Baby Blanket',
      craft: 'crochet',
      yarnWeight: 'worsted',
      gauge: { stitches: 16, rows: 12, unit: '4 inches' },
      sources: [{ name: 'Yarnspirations', url: 'https://yarnspirations.com' }],
      yarnBrands: ['Bernat']
    },
    {
      id: 'blanket-2',
      title: 'Easy Baby Blanket (Quick Crochet Pattern)',
      craft: 'crochet',
      yarnWeight: 'worsted',
      gauge: { stitches: 16, rows: 12, unit: '4 inches' },
      sources: [{ name: 'Ravelry', url: 'https://ravelry.com' }],
      yarnBrands: ['Loops & Threads']
    },
    {
      id: 'shawl-1',
      title: 'Delicate Lace Shawl',
      craft: 'knitting',
      yarnWeight: 'fingering',
      gauge: { stitches: 26, rows: 34, unit: '4 inches' },
      sources: [{ name: 'Knitting Fever', url: 'https://knittingfever.com' }],
      yarnBrands: ['Noro']
    }
  ];

  const deduped = loadPatterns(sampleDuplicatePatterns);
  assert.strictEqual(deduped.length, 2);
  assert.strictEqual(deduped.duplicatesRemoved, 1);
  assert.strictEqual(deduped.summary.original, 3);
  assert.strictEqual(deduped.summary.after, 2);

  const mergedPattern = deduped.find(p => p.id === 'blanket-1');
  assert.ok(mergedPattern);
  assert.strictEqual(mergedPattern.sources.length, 2);
  assert.ok(mergedPattern.yarnBrands.includes('Bernat'));
  assert.ok(mergedPattern.yarnBrands.includes('Loops & Threads'));
});

test('loadCatalogs loads all yarn catalogs and returns unified catalog object', () => {
  const unified = loadCatalogs();

  assert.ok(unified);
  assert.ok(Array.isArray(unified.yarns));
  assert.ok(Array.isArray(unified.patterns));
  assert.ok(unified.metadata);

  // Metadata properties
  assert.strictEqual(typeof unified.metadata.sourcesLoaded, 'number');
  assert.strictEqual(unified.metadata.sourcesLoaded, 6);
  assert.strictEqual(unified.metadata.yarnsTotal, unified.yarns.length);
  assert.strictEqual(unified.metadata.patternsTotal, unified.patterns.length);
  assert.strictEqual(typeof unified.metadata.duplicatesRemoved, 'number');

  // Verify unique yarns
  const yarnIds = unified.yarns.map(y => y.id);
  const uniqueIds = new Set(yarnIds);
  assert.strictEqual(yarnIds.length, uniqueIds.size);
  assert.strictEqual(unified.yarns.length, 20);

  // Verify patterns
  assert.strictEqual(unified.patterns.length, 10);

  // Verify available brands
  assert.ok(Array.isArray(unified.brands));
  assert.ok(unified.brands.includes('Bernat'));
  assert.ok(unified.brands.includes('Lion Brand'));
  assert.ok(unified.brands.includes('Red Heart'));
  assert.ok(unified.brands.includes('Loops & Threads'));
  assert.ok(unified.brands.includes('Big Twist'));
});

test('loadCatalogs dynamically discovers and loads new brand catalogs without code changes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'));

  try {
    const patternsContent = fs.readFileSync(path.resolve(__dirname, '../data/patterns.sample.json'), 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'patterns.sample.json'), patternsContent);

    const brand1 = {
      source: 'Brand Alpha',
      brands: ['Alpha Yarn'],
      yarns: [
        { id: 'alpha-1', brand: 'Alpha Yarn', name: 'Alpha Worsted', weight: 'worsted' }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'alpha.sample.json'), JSON.stringify(brand1));

    const brand2 = {
      source: 'Walmart Mainstays',
      brands: ['Mainstays'],
      yarns: [
        { id: 'mainstays-chenille', brand: 'Mainstays', name: 'Chenille Yarn', weight: 'super-bulky' }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'walmart-mainstays.sample.json'), JSON.stringify(brand2));

    const brand3 = {
      source: 'Future Brand Innovations',
      brands: ['FutureFiber'],
      yarns: [
        { id: 'future-soft', brand: 'FutureFiber', name: 'Nano Soft', weight: 'dk' }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'future-brand.sample.json'), JSON.stringify(brand3));

    const result = loadCatalogs(tmpDir);
    assert.strictEqual(result.metadata.sourcesLoaded, 3);
    assert.strictEqual(result.yarns.length, 3);
    assert.ok(result.yarns.some(y => y.id === 'alpha-1'));
    assert.ok(result.yarns.some(y => y.id === 'mainstays-chenille'));
    assert.ok(result.yarns.some(y => y.id === 'future-soft'));

    assert.ok(result.brands.includes('Alpha Yarn'));
    assert.ok(result.brands.includes('Mainstays'));
    assert.ok(result.brands.includes('FutureFiber'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('getYarnsByBrand filters yarns by brand name case-insensitively', () => {
  const bernatYarns = getYarnsByBrand('Bernat');
  assert.ok(bernatYarns.length > 0);
  assert.ok(bernatYarns.every(y => y.brand.toLowerCase() === 'bernat'));

  const bernatLower = getYarnsByBrand('bernat');
  assert.deepStrictEqual(bernatYarns, bernatLower);

  const nonExistent = getYarnsByBrand('NonExistentBrand');
  assert.deepStrictEqual(nonExistent, []);

  // With custom yarns list passed as argument
  const customYarns = [
    { id: 'y1', brand: 'CustomBrand', name: 'Yarn A' },
    { id: 'y2', brand: 'OtherBrand', name: 'Yarn B' }
  ];
  const filtered = getYarnsByBrand('custombrand', customYarns);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, 'y1');

  // With empty / invalid inputs
  assert.deepStrictEqual(getYarnsByBrand(''), []);
  assert.deepStrictEqual(getYarnsByBrand(null), []);
});

test('getPatternsByDifficulty filters patterns by difficulty level case-insensitively', () => {
  const beginner = getPatternsByDifficulty('beginner');
  assert.ok(beginner.length > 0);
  assert.ok(beginner.every(p => p.difficulty.toLowerCase() === 'beginner'));

  const beginnerUpper = getPatternsByDifficulty('BEGINNER');
  assert.deepStrictEqual(beginner, beginnerUpper);

  const advanced = getPatternsByDifficulty('advanced');
  assert.ok(advanced.length > 0);
  assert.ok(advanced.every(p => p.difficulty.toLowerCase() === 'advanced'));

  // With custom patterns list passed as argument
  const customPatterns = [
    { id: 'p1', title: 'Pattern 1', difficulty: 'easy' },
    { id: 'p2', title: 'Pattern 2', difficulty: 'hard' }
  ];
  const filtered = getPatternsByDifficulty('easy', customPatterns);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, 'p1');

  // With empty / invalid inputs
  assert.deepStrictEqual(getPatternsByDifficulty(''), []);
  assert.deepStrictEqual(getPatternsByDifficulty(null), []);
});

test('getAvailableBrands returns list of all brands', () => {
  const brands = getAvailableBrands();
  assert.ok(Array.isArray(brands));
  assert.ok(brands.length > 0);
  assert.ok(brands.includes('Bernat'));
  assert.ok(brands.includes('Lion Brand'));
});

test('camelCase catalogLoader export works identically', () => {
  const catalogLoader = require('../src/catalogLoader');
  assert.strictEqual(typeof catalogLoader.loadCatalogs, 'function');
  assert.strictEqual(typeof catalogLoader.loadCatalog, 'function');
  assert.strictEqual(typeof catalogLoader.loadPatterns, 'function');
  assert.strictEqual(typeof catalogLoader.getYarnsByBrand, 'function');
  assert.strictEqual(typeof catalogLoader.getPatternsByDifficulty, 'function');

  const unified = catalogLoader.loadCatalogs();
  assert.strictEqual(unified.yarns.length, 20);
});
