import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { isListingCategory, LISTING_CATEGORIES } from "../lib/enums";
import { embedQuery } from "./llm";
import { findEvidence } from "./retrieval";
import { foldDiacritics } from "./vector";
import type { SourcePassage } from "./prompt";

/**
 * The assistant's tools, as LangChain `tool()` definitions.
 *
 * Two different trust models live in this file, and the difference decides
 * how each tool is wired into the graph:
 *
 *   `searchArchive` is NOT model-invoked. The graph runs it as an
 *   always-on node, because a tool the model may call is also a tool the
 *   model may skip — and "the model decided not to look" is precisely the
 *   failure guardrail one exists to prevent. It is still a real LangChain
 *   Tool so that any future agent, or LangSmith trace, can use and see it.
 *
 *   `findListings` and `checkAvailability` ARE offered to the model, in
 *   the trip-planning branch only. They read live booking tables, so the
 *   worst a wrong call can do is return no rows — there is nothing to
 *   hallucinate, and the results enter the same numbered-sources prompt
 *   as archive passages, where the citation verifier applies to them too.
 *
 * Every tool returns a JSON string (that is the LangChain contract), and
 * each carries a typed runner the graph uses to get the parsed shape back
 * without a stringly detour.
 */

export interface ToolEvidence extends SourcePassage {
  id: string;
  sourceId: string;
  href: string | null;
  score: number;
}

// ── Archive search ───────────────────────────────────────────────────

const searchArchiveSchema = z.object({
  query: z.string().min(1).describe("What the visitor wants to know, as a standalone question."),
  locale: z.enum(["en", "vi"]).describe("Language of the conversation."),
});

/** Typed runner: embed the query, rank the corpus, keep what clears the threshold. */
export async function runArchiveSearch(input: z.infer<typeof searchArchiveSchema>): Promise<ToolEvidence[]> {
  const vector = Float32Array.from(await embedQuery(input.query));
  const matches = await findEvidence(input.query, input.locale, vector);
  return matches.map((m) => ({
    id: m.document.id,
    sourceType: m.document.sourceType,
    sourceId: m.document.sourceId,
    title: m.document.title,
    content: m.document.content,
    metadata: m.document.metadata,
    href: m.document.href,
    score: m.score,
  }));
}

export const searchArchive = tool(
  async (input) => JSON.stringify(await runArchiveSearch(searchArchiveSchema.parse(input))),
  {
    name: "search_archive",
    description:
      "Search the Committee-reviewed community archive (culture, etiquette, Ê Đê phrases, " +
      "experience descriptions). Returns the only passages an answer may be based on; an " +
      "empty result means the question must be declined, not answered from memory.",
    schema: searchArchiveSchema,
  }
);

// ── Listings ─────────────────────────────────────────────────────────

const findListingsSchema = z.object({
  category: z
    .enum(LISTING_CATEGORIES)
    .optional()
    .describe("Narrow to one kind of experience, if the visitor asked for one."),
  buon: z.string().optional().describe('Village name to filter by, e.g. "Buôn Akô Dhông".'),
  // .min(1), not .positive(): identical for integers, but .positive()
  // serialises to JSON Schema's exclusiveMinimum, which Gemini's function-
  // declaration parser rejects with a 400 — .min(1) becomes plain minimum.
  maxPriceVnd: z.number().int().min(1).optional().describe("Upper price bound in VND."),
});

export async function runFindListings(
  input: z.infer<typeof findListingsSchema>
): Promise<ToolEvidence[]> {
  const listings = await prisma.listing.findMany({
    where: {
      published: true,
      ...(input.category && isListingCategory(input.category) ? { category: input.category } : {}),
      ...(input.maxPriceVnd ? { priceVnd: { lte: input.maxPriceVnd } } : {}),
      ...(input.buon
        ? { provider: { buon: { contains: input.buon, mode: "insensitive" } } }
        : {}),
    },
    include: { provider: true },
    orderBy: { priceVnd: "asc" },
    take: 6,
  });

  return listings.map((l) => ({
    id: `listing:${l.id}`,
    sourceType: "Listing",
    sourceId: l.id,
    title: l.title,
    // The live price IS included here, unlike in the embedded corpus: this
    // is read fresh from the table on every call, so it cannot go stale.
    content:
      `${l.title} — ${l.provider.displayName}, ${l.provider.buon}.\n` +
      `${l.blurb}\n` +
      `Price: ${l.priceVnd.toLocaleString("vi-VN")} VND ${l.unit}. ` +
      `Duration: ${l.duration}. Group size: ${l.groupSize}. Carbon: ${l.carbonRating}.\n` +
      `House rules from this household: ${l.customs || "none recorded — ask the host"}.`,
    metadata: { provider: l.provider.displayName, buon: l.provider.buon, priceVnd: l.priceVnd },
    href: "#travel",
    score: 1,
  }));
}

export const findListings = tool(
  async (input) => JSON.stringify(await runFindListings(findListingsSchema.parse(input))),
  {
    name: "find_listings",
    description:
      "List bookable experiences (homestays, guided walks, craft sessions, ceremonies) with " +
      "live prices from the booking system. Filter by category, village, or price ceiling.",
    schema: findListingsSchema,
  }
);

// ── Availability ─────────────────────────────────────────────────────

const checkAvailabilitySchema = z.object({
  listingTitle: z
    .string()
    .min(2)
    .describe("The listing to check, by (part of) its title as returned by find_listings."),
});

export async function runCheckAvailability(
  input: z.infer<typeof checkAvailabilitySchema>
): Promise<ToolEvidence[]> {
  const listing = await prisma.listing.findFirst({
    where: { published: true, title: { contains: input.listingTitle, mode: "insensitive" } },
    include: {
      provider: true,
      // The next month of real capacity. Dates with no row are not "free";
      // they are unconfirmed, and the coordinator flow owns those.
      slots: {
        where: { date: { gte: new Date() } },
        orderBy: { date: "asc" },
        take: 31,
      },
    },
  });

  if (!listing) return [];

  const open = listing.slots.filter((s) => s.booked < s.capacity);
  const lines =
    open.length === 0
      ? "No open dates are currently on the calendar. Bookings are confirmed by the KNĂ " +
        "coordinator with the household, so new dates may still be arranged."
      : open
          .map(
            (s) =>
              `${s.date.toISOString().slice(0, 10)}: ${s.capacity - s.booked} of ${s.capacity} places open`
          )
          .join("\n");

  return [
    {
      id: `availability:${listing.id}`,
      sourceType: "Listing",
      sourceId: listing.id,
      title: `Availability — ${listing.title}`,
      content:
        `${listing.title} (${listing.provider.displayName}, ${listing.provider.buon}).\n` +
        `Open dates in the next month:\n${lines}\n` +
        `Every booking still waits for the coordinator to confirm the dates with the household.`,
      metadata: { provider: listing.provider.displayName, buon: listing.provider.buon },
      href: "#travel",
      score: 1,
    },
  ];
}

export const checkAvailability = tool(
  async (input) => JSON.stringify(await runCheckAvailability(checkAvailabilitySchema.parse(input))),
  {
    name: "check_availability",
    description:
      "Check the real availability calendar for one listing over the next month. Use after " +
      "find_listings when the visitor asks about dates or whether something is free.",
    schema: checkAvailabilitySchema,
  }
);

// ── Products (live price and stock) ──────────────────────────────────

const findProductsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Part of a product name, e.g. 'gùi', 'coffee', 'shoulder cloth'."),
  maxPriceVnd: z.number().int().min(1).optional().describe("Upper price bound in VND."),
});

/**
 * Live marketplace read. Price and stock deliberately never live in the
 * embedded corpus — they change with every sale — so every answer about
 * them goes through here, fresh from the table.
 */
export async function runFindProducts(
  input: z.infer<typeof findProductsSchema>
): Promise<ToolEvidence[]> {
  const where = {
    published: true,
    ...(input.maxPriceVnd ? { priceVnd: { lte: input.maxPriceVnd } } : {}),
  };

  let products = await prisma.product.findMany({
    where: {
      ...where,
      ...(input.query
        ? { title: { contains: input.query, mode: "insensitive" as const } }
        : {}),
    },
    include: { provider: true },
    orderBy: { priceVnd: "asc" },
    take: 8,
  });

  // A name the model typed without diacritics matches nothing exactly;
  // returning the whole (small) catalogue beats returning silence.
  if (products.length === 0 && input.query) {
    products = await prisma.product.findMany({
      where,
      include: { provider: true },
      orderBy: { priceVnd: "asc" },
      take: 8,
    });
  }

  return products.map((p) => ({
    id: `product:${p.id}`,
    sourceType: "Product",
    sourceId: p.id,
    title: p.title,
    content:
      `Marketplace product: ${p.title} — made by ${p.provider.displayName}, ${p.provider.buon}.\n` +
      `${p.note}\n` +
      `Price: ${p.priceVnd.toLocaleString("vi-VN")} VND. In stock right now: ${p.stock}.`,
    metadata: { provider: p.provider.displayName, buon: p.provider.buon, priceVnd: p.priceVnd },
    href: "#marketplace",
    score: 1,
  }));
}

export const findProducts = tool(
  async (input) => JSON.stringify(await runFindProducts(findProductsSchema.parse(input))),
  {
    name: "find_products",
    description:
      "Live prices and current stock for the handicraft products on the KNĂ marketplace " +
      "(baskets, textiles, woodwork, jewellery, coffee). Use whenever the visitor asks what " +
      "is for sale, what something costs, or whether it is in stock.",
    schema: findProductsSchema,
  }
);

/** Every published listing and product title — the honest menu the
 * fallback tier may suggest from, so a redirect is never an invention. */
export async function catalogTitles(): Promise<string[]> {
  const [listings, products] = await Promise.all([
    prisma.listing.findMany({ where: { published: true }, select: { title: true } }),
    prisma.product.findMany({ where: { published: true }, select: { title: true } }),
  ]);
  return [...listings, ...products].map((row) => row.title);
}

// ── Named lookup ─────────────────────────────────────────────────────

/**
 * The question names a listing or product outright — "tôi muốn biết
 * Harvest gong evening" — and deserves that exact record, live price and
 * all, whatever the embedding similarity says. A short mixed-language
 * question scores badly on vectors while being the easiest kind to answer,
 * so this runs deterministically in the knowledge route: title words are
 * matched accent-folded, and a hit is prepended to the evidence.
 */
function titleMatches(title: string, foldedQuestion: string): boolean {
  const foldedTitle = foldDiacritics(title.toLowerCase()).replace(/[^a-z0-9\s]/g, " ");
  if (foldedTitle.trim().length >= 6 && foldedQuestion.includes(foldedTitle.trim())) return true;
  const words = foldedTitle.split(/\s+/).filter((w) => w.length >= 3);
  const hits = words.filter((w) => foldedQuestion.includes(w));
  return hits.length >= 2 || hits.some((w) => w.length >= 6);
}

export async function runFindNamed(question: string): Promise<ToolEvidence[]> {
  const folded = foldDiacritics(question.toLowerCase()).replace(/[^a-z0-9\s]/g, " ");

  const [listings, products] = await Promise.all([
    prisma.listing.findMany({ where: { published: true }, include: { provider: true } }),
    prisma.product.findMany({ where: { published: true }, include: { provider: true } }),
  ]);

  const out: ToolEvidence[] = [];

  for (const l of listings) {
    if (!titleMatches(l.title, folded)) continue;
    out.push({
      id: `listing:${l.id}`,
      sourceType: "Listing",
      sourceId: l.id,
      title: l.title,
      content:
        `${l.title} — ${l.provider.displayName}, ${l.provider.buon}.\n` +
        `${l.blurb}\n` +
        `Price: ${l.priceVnd.toLocaleString("vi-VN")} VND ${l.unit}. ` +
        `Duration: ${l.duration}. Group size: ${l.groupSize}. Carbon: ${l.carbonRating}.\n` +
        `House rules from this household: ${l.customs || "none recorded — ask the host"}.`,
      metadata: { provider: l.provider.displayName, buon: l.provider.buon, priceVnd: l.priceVnd },
      href: "#travel",
      score: 1,
    });
  }

  for (const p of products) {
    if (!titleMatches(p.title, folded)) continue;
    out.push({
      id: `product:${p.id}`,
      sourceType: "Product",
      sourceId: p.id,
      title: p.title,
      content:
        `Marketplace product: ${p.title} — made by ${p.provider.displayName}, ${p.provider.buon}.\n` +
        `${p.note}\n` +
        `Price: ${p.priceVnd.toLocaleString("vi-VN")} VND. In stock: ${p.stock}.`,
      metadata: { provider: p.provider.displayName, buon: p.provider.buon, priceVnd: p.priceVnd },
      href: "#marketplace",
      score: 1,
    });
  }

  return out.slice(0, 3);
}

// ── Governance lookup ────────────────────────────────────────────────

/**
 * Questions about the Committee, its decisions, or the Community Fund
 * deserve the governance record itself, not a paragraph about governance.
 * Those passages carry English framing and proper nouns, so on a
 * Vietnamese question they score below the site's own prose — this
 * keyword route puts the actual record at the front of the evidence.
 */
export async function runFindGovernance(
  question: string,
  locale: string
): Promise<ToolEvidence[]> {
  const q = foldDiacritics(question.toLowerCase());

  const wanted: Array<(sourceId: string) => boolean> = [];
  if (/(quy cong dong|community fund|\bfund\b|ngan quy)/.test(q)) {
    wanted.push((id) => id.startsWith("fund:"));
  }
  if (/(hoi dong|committee|uy ban)/.test(q)) {
    wanted.push((id) => id === "committee");
  }
  if (/(quyet dinh|decision|bien ban|tu choi|phe duyet)/.test(q)) {
    wanted.push((id) => id.startsWith("decision:"));
  }
  if (wanted.length === 0) return [];

  const rows = await prisma.knowledgeDocument.findMany({
    where: { sourceType: "Governance", locale },
  });

  return rows
    .filter((row) => wanted.some((match) => match(row.sourceId)))
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title: row.title,
      content: row.content,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      href: row.href,
      score: 1,
    }));
}

// ── Weather ──────────────────────────────────────────────────────────

/**
 * Buôn Ma Thuột — the gateway city all three pilot buôn sit around. One
 * fixed location on purpose: this assistant plans trips inside the KNĂ
 * villages, not tourism in general, so there is nothing to geocode.
 */
const DAK_LAK = { latitude: 12.6667, longitude: 108.05 };

export async function runGetWeather(): Promise<ToolEvidence[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${DAK_LAK.latitude}&longitude=${DAK_LAK.longitude}` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max` +
    `&timezone=Asia%2FBangkok&forecast_days=7`;

  const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_min?: number[];
      temperature_2m_max?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const d = body.daily;
  if (!d?.time?.length) return [];

  const lines = d.time.map((date, i) => {
    const min = Math.round(d.temperature_2m_min?.[i] ?? NaN);
    const max = Math.round(d.temperature_2m_max?.[i] ?? NaN);
    const rain = d.precipitation_probability_max?.[i];
    return `${date}: ${min}-${max}°C${rain != null ? `, rain probability ${rain}%` : ""}`;
  });

  return [
    {
      id: `weather:${d.time[0]}`,
      sourceType: "Weather",
      sourceId: "buon-ma-thuot",
      title: "Weather forecast — Buôn Ma Thuột, Đắk Lắk (7 days)",
      content:
        "Seven-day forecast for Buôn Ma Thuột and the surrounding buôn " +
        "(Open-Meteo, fetched live):\n" +
        lines.join("\n"),
      metadata: { provider: "Open-Meteo" },
      href: null,
      score: 1,
    },
  ];
}

export const getWeather = tool(async () => JSON.stringify(await runGetWeather()), {
  name: "get_weather",
  description:
    "Seven-day weather forecast for Buôn Ma Thuột / Đắk Lắk, where all KNĂ villages are. " +
    "Use when planning an itinerary or when the visitor asks about weather or what to pack.",
  schema: z.object({}),
});

/** What the trip-planning branch offers the model. */
export const tripTools = [findListings, findProducts, checkAvailability, getWeather];
