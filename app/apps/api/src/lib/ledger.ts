import type { Prisma } from "@prisma/client";

/**
 * What the public ledger is allowed to show.
 *
 * The ledger row is written when a booking or order is *created*, because
 * the guest is shown the split before they commit — that part is right, and
 * the row is the record of what was promised. What was wrong is that the
 * public view showed those rows immediately, while the booking was still
 * PENDING and no money had moved. A booking nobody ever decided sat on the
 * public ledger forever, overstating what reached the community.
 *
 * The rest of the codebase already drew this line correctly: the provider
 * dashboard excludes PENDING from earnings, on the grounds that showing it
 * "would misrepresent what they can count on". The public ledger now holds
 * itself to the same rule.
 *
 * Settled-ness is derived from the parent rather than denormalised onto the
 * row, so there is no second copy of the truth to drift.
 */
export const SETTLED_LEDGER_WHERE: Prisma.LedgerEntryWhereInput = {
  OR: [
    { booking: { status: { in: ["CONFIRMED", "COMPLETED"] } } },
    { order: { status: { in: ["PAID", "FULFILLED"] } } },
    // An offset carries no status of its own: it is paid with the stay, so
    // it is settled exactly when its booking is. One rule, read through
    // the parent, rather than a second flag that could disagree with it.
    { offset: { booking: { status: { in: ["CONFIRMED", "COMPLETED"] } } } },
  ],
};

/** The counterpart: promised, but not yet money. Reported, never summed in. */
export const PENDING_LEDGER_WHERE: Prisma.LedgerEntryWhereInput = {
  OR: [
    { booking: { status: "PENDING" } },
    { order: { status: "PENDING" } },
    { offset: { booking: { status: "PENDING" } } },
  ],
};
