/**
 * Yarn and Pattern Catalog Loader Module
 * 
 * Loads yarn brand catalogs and pattern databases from the data directory,
 * deduplicates patterns using deduplicator.js, consolidates yarns across brands,
 * and provides querying and filtering utilities.
 */

const fs = require('fs');
const path = require('path');
const { deduplicatePatterns } = require('./deduplicator');

const DEFAULT_DATA_DIR = path.resolve(__dirname, '../data');

let defaultCatalog = null;

/**
 * Resolve a file path across absolute path, cwd-relative, or data-dir relative.
 */
function resolveFilePath(filePath, defaultDir = DEFAULT_DATA_DIR) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  const fromCwd = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromDefaultDir = path.resolve(defaultDir, filePath);
  if (fs.existsSync(fromDefaultDir)) {
    return fromDefaultDir;
  }
  if (!filePath.endsWith('.json')) {
    const withSampleJson = path.resolve(defaultDir, `${filePath}.sample.json`);
    if (fs.existsSync(withSampleJson)) {
      return withSampleJson;
    }
    const withJson = path.resolve(defaultDir, `${filePath}.json`);
    if (fs.existsSync(withJson)) {
      return withJson;
    }
  }
  return fromDefaultDir;
}

/**
 * Load a single catalog JSON file
 * 
 * @param {string} filename - Path or filename of catalog file
 * @returns {object} Parsed catalog object
 */
function loadCatalog(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('A valid filename string is required to load a catalog.');
  }

  const resolvedPath = resolveFilePath(filename, DEFAULT_DATA_DIR);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Catalog file not found: ${filename} (resolved to ${resolvedPath})`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse catalog JSON from ${resolvedPath}: ${err.message}`);
  }
}

/**
 * Load and deduplicate patterns
 * 
 * @param {string|Array} [source] - Optional file path or pattern array
 * @param {object} [options] - Optional options such as dataDir
 * @returns {Array} Deduplicated patterns array with metadata attached
 */
function loadPatterns(source, options = {}) {
  let rawPatterns;
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;

  if (Array.isArray(source)) {
    rawPatterns = source;
  } else {
    const filePath = source || path.join(dataDir, 'patterns.sample.json');
    const resolvedPath = resolveFilePath(filePath, dataDir);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Pattern file not found: ${filePath} (resolved to ${resolvedPath})`);
    }

    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    rawPatterns = Array.isArray(parsed) ? parsed : (parsed.patterns || []);
  }

  const dedupeResult = deduplicatePatterns(rawPatterns);
  const patterns = dedupeResult.deduplicatedPatterns;

  // Attach metadata properties to the returned array for convenience and backwards-compatibility
  patterns.summary = dedupeResult.summary;
  patterns.duplicatesRemoved = dedupeResult.patternsRemoved;
  patterns.duplicateGroupsFound = dedupeResult.duplicateGroupsFound;

  return patterns;
}

/**
 * Load all yarn catalogs and patterns, returning a unified catalog
 * 
 * @param {string|object} [options] - Optional dataDir path or options object
 * @returns {object} Unified catalog with yarns, patterns, and metadata
 */
function loadCatalogs(options = {}) {
  let dataDir = DEFAULT_DATA_DIR;
  let patternsSource = null;

  if (typeof options === 'string') {
    dataDir = path.resolve(process.cwd(), options);
  } else if (options && typeof options === 'object') {
    if (options.dataDir) {
      dataDir = path.resolve(process.cwd(), options.dataDir);
    }
    if (options.patternsFile || options.patterns) {
      patternsSource = options.patternsFile || options.patterns;
    }
  }

  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const files = fs.readdirSync(dataDir).sort();
  const loadedCatalogs = [];

  for (const file of files) {
    // Only load JSON files and skip pattern files
    if (!file.endsWith('.json')) continue;
    if (file.toLowerCase().includes('pattern')) continue;

    const fullPath = path.join(dataDir, file);
    try {
      const catalog = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (catalog && Array.isArray(catalog.yarns)) {
        catalog.__filename = file;
        loadedCatalogs.push(catalog);
      }
    } catch {
      // Skip non-json or unreadable files gracefully
    }
  }

  // Consolidate yarns across all brand catalogs
  const uniqueYarns = [];
  const seenYarnKeys = new Set();
  const brandsSet = new Set();

  for (const catalog of loadedCatalogs) {
    if (Array.isArray(catalog.brands)) {
      catalog.brands.forEach(b => brandsSet.add(b));
    }

    for (const yarn of catalog.yarns) {
      const key = yarn.id || `${yarn.brand}:${yarn.name}`;
      if (!seenYarnKeys.has(key)) {
        seenYarnKeys.add(key);
        uniqueYarns.push(yarn);
      }
      if (yarn.brand) {
        brandsSet.add(yarn.brand);
      }
    }
  }

  // Load and deduplicate patterns
  let resolvedPatternsSource = patternsSource;
  if (typeof patternsSource === 'string') {
    resolvedPatternsSource = resolveFilePath(patternsSource, dataDir);
  } else if (!patternsSource) {
    resolvedPatternsSource = path.join(dataDir, 'patterns.sample.json');
  }
  const patterns = loadPatterns(resolvedPatternsSource, { dataDir });
  const duplicatesRemoved = patterns.duplicatesRemoved || 0;
  const availableBrands = Array.from(brandsSet).sort();

  const unifiedCatalog = {
    yarns: uniqueYarns,
    patterns,
    brands: availableBrands,
    metadata: {
      sourcesLoaded: loadedCatalogs.length,
      yarnsTotal: uniqueYarns.length,
      patternsTotal: patterns.length,
      duplicatesRemoved,
      sources: loadedCatalogs.map(c => c.source || c.__filename),
      brands: availableBrands
    }
  };

  const isDefaultDir = dataDir === DEFAULT_DATA_DIR && !patternsSource;
  if (isDefaultDir) {
    defaultCatalog = unifiedCatalog;
  }
  return unifiedCatalog;
}

/**
 * Get yarns filtered by brand name
 * 
 * @param {string} brandName - Brand name to filter by
 * @param {Array|object} [yarnsOrCatalog] - Optional yarn array or catalog object
 * @returns {Array} Matching yarns
 */
function getYarnsByBrand(brandName, yarnsOrCatalog) {
  if (!brandName || typeof brandName !== 'string') {
    return [];
  }

  let yarnsList = yarnsOrCatalog;
  if (!yarnsList) {
    if (!defaultCatalog) {
      loadCatalogs();
    }
    yarnsList = defaultCatalog.yarns;
  } else if (yarnsList.yarns && Array.isArray(yarnsList.yarns)) {
    yarnsList = yarnsList.yarns;
  }

  if (!Array.isArray(yarnsList)) {
    return [];
  }

  const target = brandName.trim().toLowerCase();
  return yarnsList.filter(y => y.brand && y.brand.trim().toLowerCase() === target);
}

/**
 * Get patterns filtered by difficulty level
 * 
 * @param {string} difficulty - Difficulty level to filter by ('beginner', 'intermediate', 'advanced')
 * @param {Array|object} [patternsOrCatalog] - Optional pattern array or catalog object
 * @returns {Array} Matching patterns
 */
function getPatternsByDifficulty(difficulty, patternsOrCatalog) {
  if (!difficulty || typeof difficulty !== 'string') {
    return [];
  }

  let patternsList = patternsOrCatalog;
  if (!patternsList) {
    if (!defaultCatalog) {
      loadCatalogs();
    }
    patternsList = defaultCatalog.patterns;
  } else if (patternsList.patterns && Array.isArray(patternsList.patterns)) {
    patternsList = patternsList.patterns;
  }

  if (!Array.isArray(patternsList)) {
    return [];
  }

  const target = difficulty.trim().toLowerCase();
  return patternsList.filter(p => p.difficulty && p.difficulty.trim().toLowerCase() === target);
}

/**
 * Get list of all available brands across yarns and catalogs
 * 
 * @param {object} [catalog] - Optional catalog object
 * @returns {Array} Array of brand names
 */
function getAvailableBrands(catalog) {
  if (!catalog) {
    if (!defaultCatalog) {
      loadCatalogs();
    }
    catalog = defaultCatalog;
  }
  if (Array.isArray(catalog.brands)) {
    return catalog.brands.slice();
  }
  const yarns = Array.isArray(catalog) ? catalog : (catalog.yarns || []);
  const brands = new Set();
  yarns.forEach(y => {
    if (y.brand) brands.add(y.brand);
  });
  return Array.from(brands).sort();
}

// Module demo
if (require.main === module || require.main?.filename?.endsWith('catalogLoader.js')) {
  console.log('\n=== YARN & PATTERN CATALOG LOADER DEMO ===\n');

  const catalog = loadCatalogs();

  console.log(`Total yarns loaded: ${catalog.metadata.yarnsTotal}`);
  console.log(`Total patterns loaded: ${catalog.metadata.patternsTotal}`);
  console.log(`Duplicate patterns removed: ${catalog.metadata.duplicatesRemoved}`);
  console.log(`Sources loaded: ${catalog.metadata.sourcesLoaded}`);

  console.log(`\nAvailable brands (${catalog.brands.length}):`);
  console.log(catalog.brands.join(', '));

  console.log(`\nSample of deduplicated patterns (${Math.min(2, catalog.patterns.length)} shown):`);
  const sample = catalog.patterns.slice(0, 2).map(p => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    craft: p.craft,
    yarnWeight: p.yarnWeight,
    sources: p.sources ? p.sources.map(s => s.name) : [],
    yarnBrands: p.yarnBrands || []
  }));
  console.log(JSON.stringify(sample, null, 2));

  console.log("\nSample query by brand ('Bernat'):", getYarnsByBrand('Bernat').map(y => y.name));
  console.log("Sample query by difficulty ('beginner'):", getPatternsByDifficulty('beginner').map(p => p.title));
}

module.exports = {
  loadCatalogs,
  loadCatalog,
  loadPatterns,
  getYarnsByBrand,
  getPatternsByDifficulty,
  getAvailableBrands
};
