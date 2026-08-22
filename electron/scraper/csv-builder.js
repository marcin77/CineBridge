const COLS = [
  "type", "title", "original_title", "year", "director",
  "filmweb_id", "category", "user_rating",
  "rated_at", "watched_at", "comment", "list_name",
  "list_id", "list_status", "favorite",
];

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(itemsMap) {
  const rows = Object.values(itemsMap);
  const header = COLS.join(",");
  const body = rows
    .map((item) => COLS.map((c) => csvEscape(item[c])).join(","))
    .join("\n");
  return "\uFEFF" + header + "\n" + body; // BOM dla poprawnego UTF-8 w Excelu
}

module.exports = { buildCsv, COLS };