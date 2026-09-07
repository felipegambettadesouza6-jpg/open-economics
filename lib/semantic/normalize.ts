const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "até", "com", "como", "da", "das", "de", "desde", "do", "dos", "e", "em", "entre", "essa", "esse", "esta", "este", "eu", "foi", "me", "mostre", "na", "nas", "no", "nos", "o", "os", "para", "pela", "pelo", "por", "qual", "quais", "quanto", "que", "um", "uma",
  "a", "an", "and", "are", "as", "at", "be", "between", "by", "did", "do", "for", "from", "give", "how", "i", "in", "into", "is", "it", "latest", "me", "of", "official", "on", "over", "show", "since", "than", "the", "through", "to", "versus", "was", "what", "which", "with",
  "ano", "anos", "year", "years", "mes", "meses", "month", "months", "monthly", "mensal", "brasil", "brazil", "brazilian", "brasileiro", "brasileira",
]);

export function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(value: string, keepStopWords = false) {
  const tokens = normalizeText(value).split(/\s+/).filter((token) => token.length > 1);
  return [...new Set(keepStopWords ? tokens : tokens.filter((token) => {
    if (STOP_WORDS.has(token)) return false;
    // Calendar years describe the requested window, not the economic subject.
    if (/^(?:19|20|21)\d{2}$/.test(token)) return false;
    return true;
  }))];
}

export function tokenMatches(left: string, right: string) {
  if (left === right) return true;
  if (left.length < 5 || right.length < 5) return false;
  return left.startsWith(right) || right.startsWith(left);
}

export function trigrams(value: string) {
  const normalized = `  ${normalizeText(value)} `;
  const values = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    values.add(normalized.slice(index, index + 3));
  }
  return values;
}

export function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}
