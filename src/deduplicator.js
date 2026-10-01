/**
 * Duplicate Pattern Detection & Deduplication
 * 
 * Detects patterns that appear across multiple sources (Yarnspirations, Ravelry, Michaels, Joann, etc.)
 * and merges them into unified pattern records with cross-source tracking.
 */

const Levenshtein = require('levenshtein');

/**
 * Normalize pattern title for comparison
 * Removes common suffixes, standardizes spacing, lowercases
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(pattern|knit|crochet|project|free|easy|quick)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

/**
 * Calculate similarity score between two titles (0-100)
 * Uses Levenshtein distance with length normalization
 */
function titleSimilarity(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;
  
  const distance = new Levenshtein(norm1, norm2).distance;
  const maxLen = Math.max(norm1.length, norm2.length);
  const similarity = Math.max(0, 100 - (distance / maxLen) * 100);
  
  return Math.round(similarity);
}

/**
 * Calculate gauge compatibility score (0-100)
 * Patterns with very close gauge ranges are likely the same
 */
function gaugeCompatibility(gauge1, gauge2, threshold = 3) {
  if (!gauge1 || !gauge2) return 50;
  const stitches1 = gauge1.stitches || gauge1;
  const stitches2 = gauge2.stitches || gauge2;
  const range1 = typeof stitches1 === 'number' ? { min: stitches1, max: stitches1 } : stitches1;
  const range2 = typeof stitches2 === 'number' ? { min: stitches2, max: stitches2 } : stitches2;
  if (!range1?.min || !range2?.min) return 50;
  const mid1 = (range1.min + range1.max) / 2;
  const mid2 = (range2.min + range2.max) / 2;
  const diff = Math.abs(mid1 - mid2);
  
  if (diff <= threshold) return 100;
  if (diff <= threshold * 2) return 75;
  if (diff <= threshold * 3) return 50;
  return 0;
}

/**
 * Detect if two patterns are likely duplicates
 * Returns match score (0-100) where 70+ indicates likely duplicate
 */
function isDuplicate(pattern1, pattern2) {
  const titleScore = titleSimilarity(pattern1.title, pattern2.title);
  const gaugeScore = gaugeCompatibility(
    pattern1.gauge || { stitches: { min: 0, max: 0 } },
    pattern2.gauge || { stitches: { min: 0, max: 0 } }
  );
  const craftMatch = pattern1.craft === pattern2.craft ? 100 : 0;
  const weightMatch = pattern1.yarnWeight === pattern2.yarnWeight ? 100 : 50;
  
  // Weighted score: title is primary factor
  const duplicateScore = Math.round(
    titleScore * 0.4 + 
    gaugeScore * 0.25 + 
    craftMatch * 0.2 + 
    weightMatch * 0.15
  );
  
  return {
    score: duplicateScore,
    isDuplicate: duplicateScore >= 70,
    factors: {
      titleScore,
      gaugeScore,
      craftMatch,
      weightMatch
    }
  };
}

/**
 * Find all potential duplicates in a pattern list
 * Returns array of duplicate groups (each group contains similar patterns)
 */
function findDuplicateGroups(patterns) {
  const groups = [];
  const processed = new Set();
  
  patterns.forEach((pattern, idx) => {
    if (processed.has(pattern.id)) return;
    
    const group = [{ pattern, sourceIndex: idx, score: 100 }];
    processed.add(pattern.id);
    
    // Find all other patterns that match this one
    patterns.forEach((other, otherIdx) => {
      if (otherIdx <= idx || processed.has(other.id)) return;
      
      const comparison = isDuplicate(pattern, other);
      if (comparison.isDuplicate) {
        group.push({
          pattern: other,
          sourceIndex: otherIdx,
          score: comparison.score,
          factors: comparison.factors
        });
        processed.add(other.id);
      }
    });
    
    // Only add group if duplicates found
    if (group.length > 1) {
      groups.push(group);
    }
  });
  
  return groups;
}

/**
 * Merge duplicate patterns into a single unified record
 * Keeps canonical pattern and adds all sources
 */
function mergeDuplicates(duplicateGroup) {
  // Sort by score to find canonical (best match)
  const sorted = duplicateGroup.sort((a, b) => b.score - a.score);
  const canonical = sorted[0].pattern;
  
  // Merge sources from all duplicates
  const allSources = [];
  const seenSources = new Set();
  
  sorted.forEach(({ pattern }) => {
    (pattern.sources || []).forEach(source => {
      const sourceKey = `${source.name}:${source.url}`;
      if (!seenSources.has(sourceKey)) {
        allSources.push(source);
        seenSources.add(sourceKey);
      }
    });
  });
  
  // Merge yarnBrands, keeping unique entries
  const allBrands = new Set();
  sorted.forEach(({ pattern }) => {
    (pattern.yarnBrands || []).forEach(brand => allBrands.add(brand));
  });
  
  // Create merged pattern
  const merged = {
    ...canonical,
    sources: allSources,
    yarnBrands: Array.from(allBrands),
    duplicateMergedFrom: sorted.map(({ pattern, score }) => ({
      originalId: pattern.id,
      originalTitle: pattern.title,
      matchScore: score
    })),
    mergednotes: `Deduplicated from ${sorted.length} sources. Primary source: ${canonical.sources?.[0]?.name || 'Unknown'}`
  };
  
  return merged;
}

/**
 * Deduplicate patterns from multiple sources
 * Takes array of pattern catalogs, merges duplicates, returns unified list
 */
function deduplicatePatterns(patterns) {
  const duplicateGroups = findDuplicateGroups(patterns);
  const uniquePatterns = new Map();
  const processed = new Set();
  
  // Add all patterns to map (using ID as key)
  patterns.forEach(pattern => {
    uniquePatterns.set(pattern.id, pattern);
  });
  
  // Process duplicate groups
  duplicateGroups.forEach(group => {
    const merged = mergeDuplicates(group);
    
    // Keep canonical ID, mark others as processed
    uniquePatterns.set(merged.id, merged);
    group.forEach(({ pattern }, idx) => {
      if (idx !== 0) {
        uniquePatterns.delete(pattern.id);
        processed.add(pattern.id);
      }
    });
  });
  
  return {
    deduplicatedPatterns: Array.from(uniquePatterns.values()),
    duplicateGroupsFound: duplicateGroups.length,
    patternsRemoved: processed.size,
    summary: {
      original: patterns.length,
      after: uniquePatterns.size,
      deduped: processed.size
    }
  };
}

/**
 * Report on duplicates found (for debugging & analysis)
 */
function reportDuplicates(duplicateGroups) {
  return duplicateGroups.map(group => ({
    count: group.length,
    canonical: {
      id: group[0].pattern.id,
      title: group[0].pattern.title,
      source: group[0].pattern.sources?.[0]?.name
    },
    duplicates: group.slice(1).map(({ pattern, score, factors }) => ({
      id: pattern.id,
      title: pattern.title,
      source: pattern.sources?.[0]?.name,
      matchScore: score,
      factors
    }))
  }));
}

// Demo
if (require.main === module) {
  const samplePatterns = [
    {
      id: "pattern-1",
      title: "Easy Baby Blanket",
      craft: "crochet",
      yarnWeight: "worsted",
      gauge: { stitches: { min: 16, max: 16 }, rows: { min: 12, max: 12 } },
      sources: [{ name: "Yarnspirations", url: "https://example.com" }],
      yarnBrands: ["Bernat"]
    },
    {
      id: "pattern-2",
      title: "Simple Baby Afghan",
      craft: "crochet",
      yarnWeight: "worsted",
      gauge: { stitches: { min: 15, max: 17 }, rows: { min: 11, max: 13 } },
      sources: [{ name: "Ravelry", url: "https://ravelry.com" }],
      yarnBrands: ["Loops & Threads"]
    },
    {
      id: "pattern-3",
      title: "Chunky Throw Blanket",
      craft: "crochet",
      yarnWeight: "bulky",
      gauge: { stitches: { min: 9, max: 9 }, rows: { min: 10, max: 10 } },
      sources: [{ name: "Michaels", url: "https://michaels.com" }],
      yarnBrands: ["Loops & Threads"]
    }
  ];
  
  console.log("\n=== DUPLICATE DETECTION DEMO ===\n");
  
  const result = deduplicatePatterns(samplePatterns);
  console.log(`Original patterns: ${result.summary.original}`);
  console.log(`After deduplication: ${result.summary.after}`);
  console.log(`Duplicates removed: ${result.summary.deduped}`);
  console.log(`\nDeduplicatedPatterns:`, JSON.stringify(result.deduplicatedPatterns, null, 2));
}

module.exports = {
  normalizeTitle,
  titleSimilarity,
  gaugeCompatibility,
  isDuplicate,
  findDuplicateGroups,
  mergeDuplicates,
  deduplicatePatterns,
  reportDuplicates
};
