import type { Prisma } from "@prisma/client";
import type { ZodTypeAny } from "zod";

/**
 * The admin console's resource model.
 *
 * Each area of the platform is described once — its fields (which the web
 * console renders as table columns and form inputs), what may be searched
 * and filtered, which fields are never sent, and what an admin may do to it.
 * One router (routes/admin.ts) serves every resource from these
 * descriptions, and writes the audit trail for every change.
 *
 * What an admin may do follows three levels:
 *   - full CRUD for content, catalogue and people (create/update/remove);
 *   - actions only for money and chain records — the same operations the
 *     platform's own rules allow (cancel, void, retry), never raw edits;
 *   - read-only for audit logs and anything on-chain.
 * Remove unpublishes or disables when other records depend on the target,
 * and deletes only when nothing does.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "boolean"
  | "select"
  | "date"
  | "datetime"
  | "image"
  | "ref"
  | "json"
  | "mono"
  | "password";

export interface Field {
  name: string;
  type: FieldType;
  options?: readonly string[];
  /** For "ref": the resource the id points at (pickers search it). */
  ref?: string;
  /** Dotted path to show instead of the raw id, e.g. "provider.displayName". */
  display?: string;
  /** Shown as a table column. */
  list?: boolean;
  /** An input on the create form. */
  create?: boolean;
  /** An input on the edit form. */
  edit?: boolean;
  required?: boolean;
}

export interface Ctx {
  actor: { id: string; role: string };
  /** Work to run once the transaction commits (notifications, chain jobs). */
  after: (fn: () => Promise<unknown>) => void;
}

export type Row = Record<string, unknown> & { id: string };

export interface Outcome {
  outcome: "deleted" | "unpublished" | "disabled" | "withdrawn";
  reason?: string;
}

export interface ActionDef {
  name: string;
  /** Inputs the admin fills in (a reason is added when `reason` is set). */
  fields?: Field[];
  schema?: ZodTypeAny;
  /** A written reason is required, and kept in the audit trail. */
  reason?: boolean;
  danger?: boolean;
  /** Whether the action applies to this record right now. */
  when?: (row: Row) => boolean;
  /**
   * Actions that call the platform's own operations (which run their own
   * transactions) set this false; the audit row is then written after.
   */
  transactional?: boolean;
  run: (ctx: Ctx & { tx: Prisma.TransactionClient; reason: string | null }, row: Row, input: Record<string, unknown>) => Promise<unknown>;
}

export interface Resource {
  name: string;
  group: "people" | "catalog" | "money" | "governance" | "chain" | "system";
  /** The Prisma delegate, e.g. "listing". */
  model: string;
  /** The field that names a record in pickers and headings. */
  titleField: string;
  fields: Field[];
  search: string[];
  filters?: string[];
  sort?: { field: string; dir: "asc" | "desc" };
  /** Never sent to the browser. */
  hidden?: string[];
  include?: Record<string, unknown>;
  /** Shown above the table, e.g. what changing this does not change. */
  notice?: string;
  create?: {
    schema: ZodTypeAny;
    run: (ctx: Ctx & { tx: Prisma.TransactionClient }, input: Record<string, unknown>) => Promise<Row | { id?: string; [k: string]: unknown }>;
  };
  update?: {
    schema: ZodTypeAny;
    run: (ctx: Ctx & { tx: Prisma.TransactionClient }, row: Row, input: Record<string, unknown>) => Promise<Row>;
  };
  remove?: (ctx: Ctx & { tx: Prisma.TransactionClient }, row: Row) => Promise<Outcome>;
  actions?: ActionDef[];
}

export class AdminError extends Error {
  constructor(
    message: string,
    public readonly status = 409
  ) {
    super(message);
  }
}

/** JSON-safe copy of a record: BigInt as text, bytes and hidden fields dropped. */
export function serialize(row: unknown, hidden: string[] = []): Record<string, unknown> {
  const out = JSON.parse(
    JSON.stringify(row, (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Uint8Array || (v && typeof v === "object" && (v as { type?: string }).type === "Buffer")) {
        return undefined;
      }
      return v;
    })
  ) as Record<string, unknown>;
  for (const key of hidden) delete out[key];
  return out;
}

/** The fields that changed, before and after, without hidden ones. */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null, hidden: string[] = []) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    if (hidden.includes(key)) continue;
    const a = before?.[key];
    const b = after?.[key];
    if (a !== null && typeof a === "object") continue; // relations
    if (b !== null && typeof b === "object") continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { before: a ?? null, after: b ?? null };
  }
  return changes;
}

/** What the web console needs to know about a resource: no functions, no schemas. */
export function describe(resource: Resource) {
  return {
    name: resource.name,
    group: resource.group,
    titleField: resource.titleField,
    fields: resource.fields,
    search: resource.search,
    filters: resource.filters ?? [],
    notice: resource.notice ?? null,
    canCreate: Boolean(resource.create),
    canUpdate: Boolean(resource.update),
    canRemove: Boolean(resource.remove),
    actions: (resource.actions ?? []).map((a) => ({
      name: a.name,
      fields: a.fields ?? [],
      reason: Boolean(a.reason),
      danger: Boolean(a.danger),
    })),
  };
}
