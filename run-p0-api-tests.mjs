/**
 * Live P0/P1 tests against the Docker API at localhost:4000.
 * Mutates demo data (creates bookings/orders).
 */
const BASE = "http://localhost:4000";
const PASSWORD = "changeme123";

let pass = 0;
let fail = 0;
const rows = [];

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

function record(id, ok, detail) {
  rows.push({ id, ok, detail });
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
}

async function login(email) {
  return api("POST", "/auth/login", null, { email, password: PASSWORD });
}

function isoDate(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const health = await api("GET", "/health");
record("TC-HEALTH", health.status === 200 && health.json?.status === "ok", `GET /health -> ${health.status}`);

const guest = await login("guest@example.kna");
record("TC-AUTH-03a", guest.status === 200 && guest.json?.user?.role === "GUEST", `guest role=${guest.json?.user?.role}`);
const gTok = guest.json?.token;

const coord = await login("coordinator@example.kna");
record("TC-AUTH-03b", coord.status === 200 && coord.json?.user?.role === "COORDINATOR", `coordinator role=${coord.json?.user?.role}`);
const cTok = coord.json?.token;

const ami = await login("ami.hbia@example.kna");
record(
  "TC-AUTH-06",
  ami.status === 200 && ami.json?.user?.role === "PROVIDER" && ami.json?.user?.isCommitteeMember === true,
  `ami role=${ami.json?.user?.role} committee=${ami.json?.user?.isCommitteeMember}`
);
const aTok = ami.json?.token;

const artisan = await login("y.bla@example.kna");
record(
  "TC-AUTH-03c",
  artisan.status === 200 && artisan.json?.user?.role === "PROVIDER",
  `artisan role=${artisan.json?.user?.role} committee=${artisan.json?.user?.isCommitteeMember}`
);
const yTok = artisan.json?.token;

const bad = await login("guest@example.kna").catch(() => null);
const badPw = await api("POST", "/auth/login", null, { email: "guest@example.kna", password: "wrong-password" });
record("TC-AUTH-03d", badPw.status === 401, `wrong password -> ${badPw.status}`);

const uniq = `qa.${Date.now()}@example.kna`;
const su = await api("POST", "/auth/signup", null, {
  email: uniq,
  password: PASSWORD,
  fullName: "QA Guest",
  role: "ADMIN",
});
record("TC-AUTH-01", (su.status === 201 || su.status === 200) && su.json?.user?.role === "GUEST", `signup ${su.status} role=${su.json?.user?.role}`);

const short = await api("POST", "/auth/signup", null, { email: "short@example.kna", password: "123", fullName: "X" });
record("TC-AUTH-02a", short.status === 400, `short password -> ${short.status}`);

const dup = await api("POST", "/auth/signup", null, { email: "guest@example.kna", password: PASSWORD, fullName: "Dup" });
record("TC-AUTH-02b", dup.status === 409, `duplicate email -> ${dup.status}`);

const anonQ = await api("GET", "/bookings/pending");
record("TC-CO-01a", anonQ.status === 401, `anon pending -> ${anonQ.status}`);

const guestQ = await api("GET", "/bookings/pending", gTok);
record("TC-CO-01b", guestQ.status === 403, `guest pending -> ${guestQ.status}`);

const coordQ = await api("GET", "/bookings/pending", cTok);
record("TC-CO-01c", coordQ.status === 200, `coordinator pending count=${Array.isArray(coordQ.json) ? coordQ.json.length : "?"}`);

const artisanQ = await api("GET", "/archive/queue", yTok);
record("TC-AR-02a", artisanQ.status === 403, `artisan queue -> ${artisanQ.status}`);

const amiQ = await api("GET", "/archive/queue", aTok);
record("TC-AR-02b", amiQ.status === 200, `ami queue -> ${amiQ.status} items=${Array.isArray(amiQ.json) ? amiQ.json.length : "?"}`);

const guestAr = await api("POST", "/archive", gTok, {
  type: "Oral history",
  title: "t",
  meta: "m",
  keeperBuon: "Buon Test",
});
record("TC-AR-01a", guestAr.status === 403, `guest contribute -> ${guestAr.status}`);

const listings = await api("GET", "/listings");
const listingArr = Array.isArray(listings.json) ? listings.json : [];
record("TC-BK-01", listings.status === 200 && listingArr.length >= 1, `listings=${listingArr.length}`);

const products = await api("GET", "/products");
const productArr = Array.isArray(products.json) ? products.json : [];
const soldOut = productArr.filter((p) => p.stock <= 0);
const inStock = productArr.filter((p) => p.stock > 0);
record("TC-MP-01a", products.status === 200 && productArr.length >= 1, `products=${productArr.length} soldOut=${soldOut.length} inStock=${inStock.length}`);

const stats = await api("GET", "/community/stats");
record("TC-LD-03", stats.status === 200 && stats.json?.isDemoData === true, `isDemoData=${stats.json?.isDemoData} awaiting=${stats.json?.ledgerEntriesAwaiting}`);

const ledger0 = await api("GET", "/community/ledger?limit=100");
const ledgerArr0 = Array.isArray(ledger0.json) ? ledger0.json : [];
record("TC-LD-02a", ledger0.status === 200 && ledgerArr0.length >= 1, `public ledger rows=${ledgerArr0.length}`);

const listing = listingArr[0];
const lid = listing?.id;
const price = listing?.priceVnd;
const unit = listing?.unit;
const checkIn = isoDate(14);

const anonBook = await api("POST", "/bookings", null, { listingId: lid, guests: 2, nights: 2, checkIn });
record("TC-BK-03", anonBook.status === 401, `anon booking -> ${anonBook.status}`);

const book = await api("POST", "/bookings", gTok, {
  listingId: lid,
  guests: 2,
  nights: 2,
  checkIn,
  totalVnd: 1,
});
const bk = book.json;
record("TC-BK-06a", (book.status === 201 || book.status === 200) && bk?.status === "PENDING", `create ${book.status} status=${bk?.status} id=${bk?.id}`);

const expectedTotal = unit === "per night" ? price * 2 : price * 2;
record("TC-BK-05", bk && bk.totalVnd === expectedTotal && bk.totalVnd !== 1, `server total=${bk?.totalVnd} expected=${expectedTotal} unit=${unit}`);

const plat = bk?.platformFeeVnd;
const fund = bk?.communityFundVnd;
const payout = bk?.providerPayoutVnd;
const platRate = Math.round((bk?.totalVnd ?? 0) * 0.07);
const fundRate = Math.round((bk?.totalVnd ?? 0) * 0.03);
record(
  "TC-BK-05b",
  bk && plat + fund + payout === bk.totalVnd && plat === platRate && fund === fundRate,
  `split ${plat}+${fund}+${payout}=${bk?.totalVnd} (expect plat=${platRate} fund=${fundRate})`
);

const checkInOk = typeof bk?.checkIn === "string" && bk.checkIn.startsWith(checkIn);
record("TC-BK-06b", checkInOk && bk?.nights === 2, `checkIn=${bk?.checkIn} nights=${bk?.nights}`);

const past = await api("POST", "/bookings", gTok, { listingId: lid, guests: 1, nights: 1, checkIn: "2020-01-01" });
record("TC-BK-04a", past.status === 400, `past date -> ${past.status}`);

const nodate = await api("POST", "/bookings", gTok, { listingId: lid, guests: 1, nights: 1 });
record("TC-BK-04b", nodate.status === 400, `missing checkIn -> ${nodate.status}`);

const over = await api("POST", "/bookings", gTok, { listingId: lid, guests: 99, nights: 99, checkIn });
record("TC-BK-07", over.status === 400, `bounds -> ${over.status}`);

const ledger1 = await api("GET", "/community/ledger?limit=100");
const pendingOnLedger = (ledger1.json || []).filter((r) => r.bookingId === bk?.id);
record("TC-LD-01", pendingOnLedger.length === 0, `PENDING ${bk?.id} on public ledger=${pendingOnLedger.length}`);

const guestDec = await api("POST", `/bookings/${bk?.id}/decision`, gTok, { decision: "confirm" });
record("TC-CO-01d", guestDec.status === 403, `guest confirm -> ${guestDec.status}`);

const conf = await api("POST", `/bookings/${bk?.id}/decision`, cTok, { decision: "confirm" });
record("TC-CO-03a", conf.status === 200 && conf.json?.status === "CONFIRMED", `confirm -> ${conf.status} ${conf.json?.status}`);

const ledger2 = await api("GET", "/community/ledger?limit=100");
const after = (ledger2.json || []).filter((r) => r.bookingId === bk?.id);
record("TC-CO-03b", after.length === 1, `CONFIRMED on public ledger count=${after.length}`);

const redec = await api("POST", `/bookings/${bk?.id}/decision`, cTok, { decision: "decline" });
record("TC-CO-05", redec.status === 409, `re-decide -> ${redec.status}`);

const book2 = await api("POST", "/bookings", gTok, { listingId: lid, guests: 1, nights: 1, checkIn: isoDate(21) });
const dec2 = await api("POST", `/bookings/${book2.json?.id}/decision`, cTok, { decision: "decline" });
const ledger3 = await api("GET", "/community/ledger?limit=100");
const declinedOn = (ledger3.json || []).filter((r) => r.bookingId === book2.json?.id);
record("TC-CO-04", dec2.json?.status === "CANCELLED" && declinedOn.length === 0, `decline status=${dec2.json?.status} onLedger=${declinedOn.length}`);

if (inStock.length > 0) {
  const p = inStock[0];
  const order = await api("POST", "/orders", gTok, { items: [{ productId: p.id, quantity: 1 }] });
  const ord = order.json;
  record("TC-MP-02a", order.status === 201 || order.status === 200, `create order -> ${order.status} id=${ord?.id} status=${ord?.status}`);

  if (ord?.id) {
    const expectFee = Math.round(ord.totalVnd * 0.05);
    record("TC-MP-02b", ord.marketplaceFeeVnd === expectFee, `fee=${ord.marketplaceFeeVnd} expected 5%=${expectFee}`);

    const ledP = await api("GET", "/community/ledger?limit=100");
    const pendingOrd = (ledP.json || []).filter((r) => r.orderId === ord.id);
    record("TC-MP-04a", pendingOrd.length === 0, `PENDING order on public ledger=${pendingOrd.length}`);

    const gSettle = await api("POST", `/orders/${ord.id}/decision`, gTok, { decision: "settle" });
    record("TC-MP-06", gSettle.status === 403, `guest settle -> ${gSettle.status}`);

    const settle = await api("POST", `/orders/${ord.id}/decision`, cTok, { decision: "settle" });
    record("TC-MP-04b", settle.status === 200 && settle.json?.status === "PAID", `settle -> ${settle.status} ${settle.json?.status}`);

    const ledS = await api("GET", "/community/ledger?limit=100");
    const paidOn = (ledS.json || []).filter((r) => r.orderId === ord.id);
    record("TC-MP-04c", paidOn.length === 1, `PAID order on public ledger=${paidOn.length}`);
  }

  const products2 = await api("GET", "/products");
  const fresh = (products2.json || []).find((x) => x.id === p.id);
  if (fresh && fresh.stock > 0) {
    const stockBefore = fresh.stock;
    const ord2 = await api("POST", "/orders", gTok, { items: [{ productId: p.id, quantity: 1 }] });
    const cancel = await api("POST", `/orders/${ord2.json?.id}/decision`, cTok, { decision: "cancel" });
    const products3 = await api("GET", "/products");
    const afterP = (products3.json || []).find((x) => x.id === p.id);
    const ledC = await api("GET", "/community/ledger?limit=100");
    const cancelledOn = (ledC.json || []).filter((r) => r.orderId === ord2.json?.id);
    record(
      "TC-MP-04d",
      cancel.json?.status === "CANCELLED" && afterP?.stock === stockBefore && cancelledOn.length === 0,
      `cancel status=${cancel.json?.status} stock ${stockBefore}->${afterP?.stock} onLedger=${cancelledOn.length}`
    );
  } else {
    record("TC-MP-04d", true, "skip cancel restore — no remaining stock");
  }
} else {
  record("TC-MP-02a", false, "no in-stock product");
}

const makers = new Map();
for (const p of inStock) {
  if (!makers.has(p.providerId)) makers.set(p.providerId, p);
}
const makerList = [...makers.values()];
if (makerList.length >= 2) {
  const mix = await api("POST", "/orders", gTok, {
    items: [
      { productId: makerList[0].id, quantity: 1 },
      { productId: makerList[1].id, quantity: 1 },
    ],
  });
  record("TC-MP-05", mix.status === 400, `mixed artisans -> ${mix.status} ${mix.text}`);
} else {
  record("TC-MP-05", true, "skip — fewer than 2 in-stock makers");
}

const contrib = await api("POST", "/archive", yTok, {
  type: "Oral history",
  title: "QA entry",
  meta: "qa",
  keeperBuon: "Buon A",
});
record(
  "TC-AR-01b",
  (contrib.status === 201 || contrib.status === 200) && contrib.json?.moderationStatus === "IN_REVIEW",
  `artisan contribute ${contrib.status} moderation=${contrib.json?.moderationStatus}`
);

const pubList = await api("GET", "/archive");
const leaked = (pubList.json || []).filter((e) => e.id === contrib.json?.id);
record("TC-AR-01c", leaked.length === 0, `IN_REVIEW on public archive=${leaked.length}`);

const dashY = await api("GET", "/providers/me", yTok);
const dashA = await api("GET", "/providers/me", aTok);
record("TC-CO-06a", dashY.status === 200, `artisan dashboard -> ${dashY.status}`);
record("TC-CO-06b", dashA.status === 200, `ami dashboard -> ${dashA.status}`);

const nt = await api("GET", "/notifications", gTok);
record("TC-NT-01a", nt.status === 200 && Array.isArray(nt.json?.items), `guest notifications -> ${nt.status} items=${nt.json?.items?.length} unread=${nt.json?.unread}`);

const ntAnon = await api("GET", "/notifications");
record("TC-NT-02a", ntAnon.status === 401, `anon notifications -> ${ntAnon.status}`);

// search case-insensitive
const search = await api("GET", "/listings?q=wik");
const searchArr = Array.isArray(search.json) ? search.json : [];
record("TC-BK-02", search.status === 200 && searchArr.length >= 1, `q=wik listings=${searchArr.length}`);

console.log("");
console.log(`==== SUMMARY  PASS=${pass}  FAIL=${fail}  TOTAL=${pass + fail} ====`);
process.exit(fail > 0 ? 1 : 0);
