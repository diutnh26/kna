/**
 * Vector storage and similarity, without pgvector.
 *
 * ── Why not pgvector ─────────────────────────────────────────────────
 *
 * The corpus is a few hundred short cards. At that size an exact scan is
 * both faster and *more correct* than an approximate index: 200 documents
 * × 1024 dimensions is 200 dot products, well under a millisecond, and it
 * returns the true nearest neighbours rather than HNSW's approximation.
 * pgvector earns its keep at millions of rows; here it would be pure
 * operational cost.
 *
 * And that cost is real for this project specifically. The extension is
 * not in the `postgres:17` image CI runs, not in the portable Windows
 * build `apps/api/README.md` documents for development, and installing it
 * on Windows without admin means an MSVC toolchain. It *is* available on
 * Neon. So adopting it would mean the extension exists in production and
 * nowhere else — exactly the development/production divergence the "One
 * engine everywhere" section of that README says was learned the hard way.
 *
 * Embeddings are therefore stored as raw little-endian float32 in a
 * `Bytes` column: 1024 dims × 4 bytes = 4 KB per document, so the whole
 * corpus is under a megabyte and fits Neon's free tier many times over.
 *
 * When the corpus passes ~50k documents this becomes the wrong call. The
 * change is contained: `packEmbedding` / the scan in `retrieval.ts`, and
 * nothing above them knows how similarity is computed.
 */

/**
 * Scales a vector to unit length.
 *
 * Stored normalised so that cosine similarity is a plain dot product at
 * query time — one multiply-add per dimension instead of also computing
 * two magnitudes for every candidate. Ollama's bge-m3 vectors arrive
 * unnormalised (magnitude ~25), so this is not optional.
 */
export function normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const v of values) sumSquares += v * v;
  const magnitude = Math.sqrt(sumSquares);
  // A zero vector has no direction to preserve. Returning it unchanged
  // makes it score 0 against everything, which is the honest answer.
  if (magnitude === 0 || !Number.isFinite(magnitude)) return values.slice();
  return values.map((v) => v / magnitude);
}

/** Packs a normalised vector into the byte layout stored in the database. */
export function packEmbedding(values: number[]): Uint8Array<ArrayBuffer> {
  // Built over an explicit ArrayBuffer: Prisma's Bytes columns take
  // Uint8Array<ArrayBuffer>, and TypeScript will not narrow a typed
  // array's `.buffer` past ArrayBufferLike on its own.
  const buffer = new ArrayBuffer(values.length * 4);
  new Float32Array(buffer).set(values);
  return new Uint8Array(buffer);
}

/**
 * Reads a vector back out of its stored bytes.
 *
 * Copies rather than viewing the Buffer in place: Node allocates small
 * Buffers out of a shared pool, so `byteOffset` is rarely 0 and a
 * Float32Array view would need the offset to be 4-byte aligned, which the
 * pool does not promise.
 */
export function unpackEmbedding(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 4 !== 0) {
    throw new Error(`Embedding blob is ${bytes.byteLength} bytes, not a whole number of float32s.`);
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/**
 * Cosine similarity, assuming both vectors are already normalised.
 *
 * Returns 0 for mismatched lengths rather than throwing. Length mismatch
 * means the two vectors came from different embedding models, and the
 * caller filters those out by model name — this is the belt to those
 * braces, and a document that scores 0 simply never wins.
 */
export function similarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Strips Vietnamese diacritics for a secondary, accent-insensitive match.
 *
 * Diacritics carry meaning in Vietnamese, so this never replaces the
 * accented form — it supplements it. People type "cong chieng" on a
 * keyboard without a Vietnamese layout constantly, and a search that
 * cannot find "Cồng Chiêng" from that is a search that looks broken.
 *
 * Đ/đ needs its own rule: it is a distinct letter, not D with a mark, so
 * Unicode decomposition leaves it alone.
 */
export function foldDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Lowercased word tokens, with the accent-folded form of each appended. */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((w) => w.length > 1);

  const out: string[] = [];
  for (const word of words) {
    out.push(word);
    const folded = foldDiacritics(word);
    if (folded !== word) out.push(folded);
  }
  return out;
}

/**
 * Lexical overlap between a question and a document, in [0, 1].
 *
 * Deliberately simple: rarer words count for more (the `idf` map), and the
 * score is the share of the question's weight that the document covers.
 * This is not BM25 and does not try to be. It exists to catch the case
 * dense retrieval is worst at — a rare proper noun like "Akô Dhông" that
 * the embedding model has never seen and therefore places arbitrarily.
 */
export function lexicalScore(
  questionTokens: string[],
  documentTokens: Set<string>,
  idf: Map<string, number>
): number {
  if (questionTokens.length === 0) return 0;

  let matched = 0;
  let total = 0;
  const seen = new Set<string>();

  for (const token of questionTokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    // Unseen words are the rarest of all, so they get the ceiling weight.
    const weight = idf.get(token) ?? 3;
    total += weight;
    if (documentTokens.has(token)) matched += weight;
  }

  return total === 0 ? 0 : matched / total;
}

/**
 * Inverse document frequency over the corpus, capped.
 *
 * The cap stops a single hapax legomenon from swamping the score — with a
 * corpus this small, a word appearing once is common, not remarkable.
 */
export function buildIdf(documents: Array<Set<string>>): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const tokens of documents) {
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const total = Math.max(documents.length, 1);
  const idf = new Map<string, number>();
  for (const [token, count] of frequency) {
    idf.set(token, Math.min(3, Math.log(1 + total / count)));
  }
  return idf;
}
