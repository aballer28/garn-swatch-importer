const fs = require("fs");
const path = require("path");
const { normalizeYarn, normalizePattern, validateYarn, validatePattern } = require("./schema");

function importCatalog(filePath, source = path.basename(filePath, path.extname(filePath))) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const yarns = (payload.yarns || []).map((record) => normalizeYarn(record, source));
  const patterns = (payload.patterns || []).map((record) => normalizePattern(record, source));
  const errors = [
    ...yarns.flatMap((record) => validateYarn(record).map((error) => ({ type: "yarn", id: record.id, error }))),
    ...patterns.flatMap((record) => validatePattern(record).map((error) => ({ type: "pattern", id: record.id, error })))
  ];
  return { source, yarns, patterns, errors, valid: errors.length === 0 };
}

if (require.main === module) {
  const result = importCatalog(process.argv[2] || "../data/yarnspirations.sample.json");
  console.log(JSON.stringify({ source: result.source, yarns: result.yarns.length, patterns: result.patterns.length, valid: result.valid, errors: result.errors }, null, 2));
  process.exitCode = result.valid ? 0 : 1;
}

module.exports = { importCatalog };
