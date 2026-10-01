# Yarn Match

A yarn, gauge, strand, and pattern matching tool for knitters and crocheters.

## First catalog source: Yarnspirations

The first source adapter is designed around Yarnspirations and its brands, including Bernat, Caron, Patons, Red Heart, Lily Sugar'n Cream, Aunt Lydia's, Coats & Clark, and Phentex.

This first commit deliberately uses normalized sample data rather than scraping or claiming live inventory. Before importing production catalog or stock data, obtain permission or use an approved feed/API and respect the site's terms and robots rules.

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
