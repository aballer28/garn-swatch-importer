/**
 * Unified Catalog Loader
 * 
 * Aggregates all yarn catalogs from the data directory and provides
 * brand statistics, normalized yarn records, and pattern loading.
 */

const fs = require('fs');
const path = require('path');
const { loadPatterns } = require('./deduplicator');

const DEFAULT_DATA_DIR = path.join(__dirname, '../data');

/**
 * Load all yarn catalogs from the data directory
 * Reads every .sample.json or .json file except patterns
 */
function loadAllYarns(dataDir = DEFAULT_DATA_DIR) {
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  const files = fs.readdirSync(dataDir).filter(file => {
    return (file.endsWith('.json') || file.endsWith('.sample.json')) && !file.startsWith('patterns');
  });

  const yarns = [];
  const seenYarnIds = new Set();

  files.forEach(file => {
    try {
      const fullPath = path.join(dataDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(content);

      if (Array.isArray(data.yarns)) {
        data.yarns.forEach(rawYarn => {
          // Normalize yarn record
          const id = rawYarn.id || `${rawYarn.brand}-${rawYarn.name}`.toLowerCase().replace(/\s+/g, '-');
          if (!seenYarnIds.has(id)) {
            seenYarnIds.add(id);
            yarns.push({
              id,
              brand: rawYarn.brand || 'Unknown',
              name: rawYarn.name || '',
              weight: (rawYarn.weight || 'unknown').toLowerCase(),
              fiber: Array.isArray(rawYarn.fiber) ? rawYarn.fiber : (rawYarn.fiber ? [rawYarn.fiber] : []),
              stitchesPer4Inches: rawYarn.stitchesPer4Inches || { min: 0, max: 0 },
              yardagePer100g: rawYarn.yardagePer100g || 0,
              strands: rawYarn.strands || 1,
              availability: rawYarn.availability || { status: 'unknown', checkedAt: null, url: null },
              price: rawYarn.price !== undefined ? rawYarn.price : null,
              source: data.source || file
            });
          }
        });
      }
    } catch (err) {
      console.error(`Warning: Failed to load yarn catalog file ${file}:`, err.message);
    }
  });

  return yarns;
}

/**
 * Get all brands and their yarn count from the catalog
 * Returns array of { brand, count } sorted by count descending, then alphabetically
 */
function getAllBrands(dataDir = DEFAULT_DATA_DIR) {
  const yarns = loadAllYarns(dataDir);
  const brandCounts = new Map();

  // Also collect brands mentioned in catalog header files
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter(file => {
      return (file.endsWith('.json') || file.endsWith('.sample.json')) && !file.startsWith('patterns');
    });

    files.forEach(file => {
      try {
        const fullPath = path.join(dataDir, file);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (Array.isArray(data.brands)) {
          data.brands.forEach(b => {
            if (!brandCounts.has(b)) {
              brandCounts.set(b, 0);
            }
          });
        }
      } catch (err) {
        // Ignore read errors
      }
    });
  }

  // Count yarns per brand
  yarns.forEach(yarn => {
    const current = brandCounts.get(yarn.brand) || 0;
    brandCounts.set(yarn.brand, current + 1);
  });

  const result = [];
  brandCounts.forEach((count, brand) => {
    result.push({ brand, count });
  });

  // Sort by count descending, then brand name ascending
  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.brand.localeCompare(b.brand);
  });

  return result;
}

/**
 * Load unified catalog containing both yarns and brand stats
 */
function loadUnifiedCatalog(dataDir = DEFAULT_DATA_DIR) {
  const yarns = loadAllYarns(dataDir);
  const brands = getAllBrands(dataDir);
  return {
    yarns,
    brands,
    totalYarns: yarns.length
  };
}

// Demo when executed directly
if (require.main === module) {
  console.log('\n=== UNIFIED YARN CATALOG LOADER ===\n');
  const catalog = loadUnifiedCatalog();
  console.log(`Total Yarns Loaded: ${catalog.totalYarns}`);
  console.log(`Total Brands: ${catalog.brands.length}\n`);
  console.log('Brands breakdown:');
  console.table(catalog.brands);
}

module.exports = {
  loadAllYarns,
  getAllBrands,
  loadUnifiedCatalog,
  loadPatterns
};
