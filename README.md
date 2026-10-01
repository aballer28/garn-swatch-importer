# Yarn Match

A yarn, gauge, strand, and pattern matching tool for knitters and crocheters.

## First catalog source: Yarnspirations

The first source adapter is designed around Yarnspirations and its brands, including Bernat, Caron, Patons, Red Heart, Lily Sugar'n Cream, Aunt Lydia's, Coats & Clark, and Phentex.

This first commit deliberately uses normalized sample data rather than scraping or claiming live inventory. Before importing production catalog or stock data, obtain permission or use an approved feed/API and respect the site's terms and robots rules.

## Interactive CLI Tool

Run the interactive CLI:

```bash
npm run cli
```

The CLI main menu provides:
1. **Yarn → Patterns Search:** Input yarn specifications (stitch gauge, row gauge, yarn weight, total yardage, fiber) to find the top 10 compatible patterns with match scores (0-100), craft type, difficulty, and tailored recommendations.
2. **Pattern → Yarns Search:** Input pattern requirements (category, craft type, stitch gauge, row gauge, yarn weight, yardage needed, fiber) to find the top 10 compatible yarns from the unified catalog with match scores, brand, availability, price, and skein estimates.
3. **View All Brands:** List all yarn brands in the catalog with total yarn counts per brand.
4. **Exit:** Return to the main menu after each search until ready to exit.

Results are categorized into match quality tiers (**Perfect**, **Good**, **Acceptable**, **Poor**) and formatted as clear tables with recommendations.

## Run the matching demo

```bash
node src/matcher.js
```

The matcher returns a score from 0 to 100 and includes single-strand and double-strand options. A missing yarn can be entered by supplying its gauge and yarn weight.

## Planned data sources

- Yarnspirations-approved catalog/inventory feed
- Ravelry, subject to API access and terms
- Brand websites, subject to permission
- Retailer/store inventory integrations

## Matching inputs

- Stitch gauge (stitches per 4 inches)
- Row gauge (optional)
- Yarn weight/category
- Fiber type (optional)
- Strand count
- Pattern gauge and yarn requirements

Inventory should be shown with a `checkedAt` timestamp and source URL; an unknown stock state must not be presented as in stock.
