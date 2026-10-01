# Yarn Match

A yarn, gauge, strand, and pattern matching tool for knitters and crocheters.

## First catalog source: Yarnspirations

The first source adapter is designed around Yarnspirations and its brands, including Bernat, Caron, Patons, Red Heart, Lily Sugar'n Cream, Aunt Lydia's, Coats & Clark, and Phentex.

This first commit deliberately uses normalized sample data rather than scraping or claiming live inventory. Before importing production catalog or stock data, obtain permission or use an approved feed/API and respect the site's terms and robots rules.

## Run the matching demo

```bash
npm install
npm test
node src/matcher.js
```

The matcher returns a score from 0 to 100 and includes single-strand and double-strand options. A missing yarn can be entered by supplying its gauge and yarn weight.

## Normalized data contract

Yarn records use `id`, `brand`, `name`, a lowercase `weight`, a non-empty `fiber` array, a `stitchesPer4Inches` range (`{ "min": 16, "max": 20 }`), `strands` (`1` or `2`), and `availability`. Inventory status is `in-stock`, `out-of-stock`, or `unknown`; known statuses require both `checkedAt` and `url`. Unknown inventory is never treated as available.

Pattern records use `id`, `title`, `craft`, lowercase `yarnWeight`, `fiberTypes`, `strandCount`, and `gauge`. Gauge stitches and rows may be numbers in source data, but are normalized to ranges; rows are optional. The matcher accepts both this normalized shape and the legacy `weight`/`stitchesPer4Inches` fields.

## Import and validation

Only import files supplied by an approved catalog feed:

```bash
node src/importer.js data/yarnspirations.sample.json
```

The importer namespaces IDs with the source name, normalizes scalar gauges and weight casing, validates every record, and reports record-level errors without discarding valid records. It does not fetch websites or infer unknown inventory.

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
