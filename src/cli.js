/**
 * Interactive Yarn & Pattern Matching CLI Tool
 * 
 * Provides interactive command-line access to:
 * 1. Yarn -> Patterns Search
 * 2. Pattern -> Yarns Search
 * 3. View All Brands in Catalog
 */

const readline = require('readline');
const { loadAllYarns, getAllBrands, loadPatterns } = require('./catalog');
const { WEIGHTS, matchYarnToPatterns, matchPatternToYarns } = require('./matcher');

/**
 * Creates a robust prompt interface that supports both interactive TTY
 * and piped/buffered input streams without use-after-close errors.
 */
function createPromptInterface(input = process.stdin, output = process.stdout) {
  const rl = readline.createInterface({
    input,
    output,
    terminal: !!output.isTTY,
    crlfDelay: Infinity
  });

  const lines = [];
  let pendingResolver = null;
  let closed = false;

  rl.on('line', (line) => {
    if (pendingResolver) {
      const resolve = pendingResolver;
      pendingResolver = null;
      resolve(line.trim());
    } else {
      lines.push(line.trim());
    }
  });

  rl.on('close', () => {
    closed = true;
    if (pendingResolver) {
      const resolve = pendingResolver;
      pendingResolver = null;
      resolve(null);
    }
  });

  function ask(query) {
    if (query && output && output.write) {
      output.write(query);
    }
    if (lines.length > 0) {
      return Promise.resolve(lines.shift());
    }
    if (closed) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      pendingResolver = resolve;
    });
  }

  function close() {
    rl.close();
  }

  return { ask, close };
}

/**
 * Prompt for a required positive number with validation
 */
async function promptPositiveNumber(prompt, fieldName, example = '18') {
  while (true) {
    const input = await prompt.ask(`  Enter ${fieldName} (e.g., ${example}): `);
    if (input === null) return null; // Stream closed
    const num = Number(input);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
    console.log(`  ❌ Invalid input. Please enter a valid positive number for ${fieldName}.`);
  }
}

/**
 * Prompt for an optional positive number with validation
 */
async function promptOptionalPositiveNumber(prompt, fieldName, example = '24') {
  while (true) {
    const input = await prompt.ask(`  Enter ${fieldName} (optional, press Enter to skip, e.g., ${example}): `);
    if (input === null) return null; // Stream closed
    if (input === '') {
      return null;
    }
    const num = Number(input);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
    console.log(`  ❌ Invalid input. Please enter a positive number or press Enter to skip.`);
  }
}

/**
 * Normalize and validate yarn weight
 */
function normalizeWeight(rawWeight) {
  if (!rawWeight) return null;
  const normalized = rawWeight.toLowerCase().trim().replace(/\s+/g, '-');
  return WEIGHTS.includes(normalized) ? normalized : null;
}

/**
 * Prompt for yarn weight with validation
 */
async function promptYarnWeight(prompt) {
  const validList = WEIGHTS.join(', ');
  while (true) {
    const input = await prompt.ask(`  Enter yarn weight (${validList}): `);
    if (input === null) return null;
    const normalized = normalizeWeight(input);
    if (normalized) {
      return normalized;
    }
    console.log(`  ❌ Invalid yarn weight "${input}".`);
    console.log(`     Available options: ${validList}`);
  }
}

/**
 * Prompt for craft type (crochet or knitting)
 */
async function promptCraftType(prompt) {
  while (true) {
    const input = await prompt.ask(`  Enter craft type (crochet, knitting): `);
    if (input === null) return null;
    const lower = input.toLowerCase().trim();
    if (lower === 'crochet' || lower === 'knitting' || lower === 'knit') {
      return lower === 'knit' ? 'knitting' : lower;
    }
    console.log(`  ❌ Invalid craft type. Please enter "crochet" or "knitting".`);
  }
}

/**
 * Prompt for pattern category
 */
async function promptPatternCategory(prompt) {
  const suggestions = 'sweater, shawl, vest, hat, blanket, dishcloth, amigurumi, afghan, booties';
  while (true) {
    const input = await prompt.ask(`  Enter pattern category (${suggestions}, etc.): `);
    if (input === null) return null;
    if (input.length > 0) {
      return input.toLowerCase();
    }
    console.log(`  ❌ Pattern category cannot be empty.`);
  }
}

/**
 * Display search results grouped by match quality
 */
function displayGroupedResults(items, renderItemFn) {
  const qualities = ['Perfect', 'Good', 'Acceptable', 'Poor'];
  const grouped = {
    Perfect: items.filter(i => i.quality === 'Perfect'),
    Good: items.filter(i => i.quality === 'Good'),
    Acceptable: items.filter(i => i.quality === 'Acceptable'),
    Poor: items.filter(i => i.quality === 'Poor')
  };

  qualities.forEach(q => {
    const list = grouped[q];
    if (list.length > 0) {
      console.log(`\n--- ${q} Matches (${q === 'Perfect' ? 'Score 90-100' : q === 'Good' ? 'Score 70-89' : q === 'Acceptable' ? 'Score 50-69' : 'Score <50'}) ---`);
      list.forEach((item, idx) => {
        renderItemFn(item, idx + 1);
      });
    }
  });
}

/**
 * Handle Option 1: Yarn -> Patterns Search
 */
async function handleYarnToPatterns(prompt, patterns) {
  console.log('\n========================================');
  console.log('       Yarn → Patterns Search');
  console.log('========================================');
  console.log('Please enter your yarn specifications:\n');

  const stitches = await promptPositiveNumber(prompt, 'stitches per 4 inches', '18');
  if (stitches === null) return;

  const rows = await promptOptionalPositiveNumber(prompt, 'rows per 4 inches', '24');
  if (rows === undefined) return;

  const weight = await promptYarnWeight(prompt);
  if (weight === null) return;

  const yardage = await promptPositiveNumber(prompt, 'total yardage available', '1200');
  if (yardage === null) return;

  const fiberInput = await prompt.ask('  Enter fiber type (optional, e.g., acrylic, cotton, wool - press Enter to skip): ');
  if (fiberInput === null) return;
  const fiber = fiberInput.length > 0 ? fiberInput : undefined;

  console.log('\n🔍 Finding compatible patterns from catalog...');
  const yarnSpecs = {
    stitchesPer4Inches: stitches,
    rowsPer4Inches: rows,
    weight,
    totalYardage: yardage,
    fiber
  };

  const results = matchYarnToPatterns(yarnSpecs, patterns);
  const top10 = results.slice(0, 10);

  if (top10.length === 0) {
    console.log('\nNo matching patterns found in the catalog.');
  } else {
    console.log(`\nFound ${results.length} patterns. Top ${top10.length} matching patterns:\n`);

    // Formatted Table View
    const tableData = top10.map((p, idx) => ({
      Rank: idx + 1,
      Score: `${p.score}/100`,
      Quality: p.quality,
      Title: p.title,
      Designer: p.designer,
      Difficulty: p.difficulty,
      'Yardage Req': p.yardageRequired,
      Craft: p.craft
    }));
    console.table(tableData);

    // Grouped Details & Recommendations View
    displayGroupedResults(top10, (p) => {
      console.log(`• [Score: ${p.score}/100 - ${p.quality}] "${p.title}" by ${p.designer}`);
      console.log(`  Craft: ${p.craft} | Difficulty: ${p.difficulty} | Yardage Required: ${p.yardageRequired} yds | Weight: ${p.yarnWeight}`);
      console.log(`  💡 Recommendation: ${p.recommendation}`);
    });
  }

  await prompt.ask('\nPress Enter to return to main menu...');
}

/**
 * Handle Option 2: Pattern -> Yarns Search
 */
async function handlePatternToYarns(prompt, yarns) {
  console.log('\n========================================');
  console.log('       Pattern → Yarns Search');
  console.log('========================================');
  console.log('Please enter your pattern requirements:\n');

  const category = await promptPatternCategory(prompt);
  if (category === null) return;

  const craft = await promptCraftType(prompt);
  if (craft === null) return;

  const stitches = await promptPositiveNumber(prompt, 'stitches per 4 inches', '18');
  if (stitches === null) return;

  const rows = await promptOptionalPositiveNumber(prompt, 'rows per 4 inches', '24');
  if (rows === undefined) return;

  const weight = await promptYarnWeight(prompt);
  if (weight === null) return;

  const yardageNeeded = await promptPositiveNumber(prompt, 'yardage needed', '1000');
  if (yardageNeeded === null) return;

  const fiberInput = await prompt.ask('  Enter fiber type (optional, e.g., cotton, wool, acrylic - press Enter to skip): ');
  if (fiberInput === null) return;
  const fiber = fiberInput.length > 0 ? fiberInput : undefined;

  console.log('\n🔍 Finding compatible yarns from catalog...');
  const patternSpecs = {
    category,
    craft,
    stitchesPer4Inches: stitches,
    rowsPer4Inches: rows,
    weight,
    yardageNeeded,
    fiber
  };

  const results = matchPatternToYarns(patternSpecs, yarns);
  const top10 = results.slice(0, 10);

  if (top10.length === 0) {
    console.log('\nNo compatible yarns found in the catalog.');
  } else {
    console.log(`\nFound ${results.length} yarn options. Top ${top10.length} matching yarns:\n`);

    // Formatted Table View
    const tableData = top10.map((y, idx) => ({
      Rank: idx + 1,
      Score: `${y.score}/100`,
      Quality: y.quality,
      Brand: y.brand,
      Name: y.name,
      Strands: y.strands === 2 ? 'Held Double' : 'Single',
      Weight: y.weight,
      Availability: y.availability,
      Price: y.price
    }));
    console.table(tableData);

    // Grouped Details & Recommendations View
    displayGroupedResults(top10, (y) => {
      const strandLabel = y.strands === 2 ? ' [Held Double]' : '';
      const skeinsStr = y.skeinsNeeded ? ` | Approx. Skeins Needed: ~${y.skeinsNeeded}` : '';
      console.log(`• [Score: ${y.score}/100 - ${y.quality}] ${y.brand} - ${y.name}${strandLabel}`);
      console.log(`  Weight: ${y.weight} | Fiber: ${y.fiber} | Availability: ${y.availability} | Price: ${y.price}${skeinsStr}`);
      console.log(`  💡 Recommendation: ${y.recommendation}`);
    });
  }

  await prompt.ask('\nPress Enter to return to main menu...');
}

/**
 * Handle Option 3: View All Brands
 */
async function handleViewAllBrands(prompt, brands, totalYarns) {
  console.log('\n========================================');
  console.log('       Catalog Yarn Brands');
  console.log('========================================\n');

  console.log(`Total Brands: ${brands.length} | Total Yarns in Catalog: ${totalYarns}\n`);

  const tableData = brands.map((b, idx) => ({
    '#': idx + 1,
    Brand: b.brand,
    'Yarn Count': b.count
  }));
  console.table(tableData);

  await prompt.ask('\nPress Enter to return to main menu...');
}

/**
 * Main interactive loop
 */
async function startCli({ input = process.stdin, output = process.stdout } = {}) {
  // Load data sources
  const yarns = loadAllYarns();
  const brands = getAllBrands();
  const patterns = loadPatterns();

  const prompt = createPromptInterface(input, output);

  try {
    let running = true;
    while (running) {
      console.log('\n========================================');
      console.log('   🧶 YARN & PATTERN MATCHING CLI 🧶');
      console.log('========================================');
      console.log('  1. Yarn → Patterns Search (Find patterns for your yarn)');
      console.log('  2. Pattern → Yarns Search (Find yarns for your pattern)');
      console.log('  3. View All Brands in Catalog');
      console.log('  4. Exit');
      console.log('========================================');

      const choice = await prompt.ask('Please select an option (1-4): ');

      if (choice === null) {
        // Stream ended (EOF)
        break;
      }

      switch (choice.trim()) {
        case '1':
          await handleYarnToPatterns(prompt, patterns);
          break;
        case '2':
          await handlePatternToYarns(prompt, yarns);
          break;
        case '3':
          await handleViewAllBrands(prompt, brands, yarns.length);
          break;
        case '4':
        case 'exit':
        case 'quit':
          console.log('\nThank you for using Yarn & Pattern Matcher! Happy crafting! 👋\n');
          running = false;
          break;
        default:
          console.log(`\n❌ Invalid choice "${choice}". Please enter a number between 1 and 4.`);
          break;
      }
    }
  } finally {
    prompt.close();
  }
}

if (require.main === module) {
  startCli().catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}

module.exports = {
  createPromptInterface,
  startCli,
  handleYarnToPatterns,
  handlePatternToYarns,
  handleViewAllBrands,
  normalizeWeight
};
