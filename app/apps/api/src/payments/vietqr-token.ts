/**
 * Cached bearer token for the VietQR proxy API
 * (token_generate → transaction-sync).
 */

let cached: { token: string; expiresAt: number } | null = null;

function baseUrl() {
  return (process.env.VIETQR_BASE_URL ?? "https://chat.thinhdoworks.com/api/v1").replace(/\/$/, "");
}

export async function getVietQRToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    return cached.token;
  }

  const username = process.env.VIETQR_USERNAME?.trim();
  const password = process.env.VIETQR_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("VIETQR_USERNAME / VIETQR_PASSWORD are not configured.");
  }

  const res = await fetch(`${baseUrl()}/vqr/api/token_generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VietQR token_generate failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as { access_token?: string; token?: string; expires_in?: number };
  const token = body.access_token ?? body.token;
  if (!token) {
    throw new Error("VietQR token_generate returned no token.");
  }

  const ttlSec = Number(
    process.env.VIETQR_TOKEN_EXPIRES_SECONDS ?? body.expires_in ?? 300
  );
  cached = { token, expiresAt: Date.now() + ttlSec * 1000 };
  return token;
}

/** Look up a bank transfer by payment reference via the proxy sync API. */
export async function syncTransaction(ref: string): Promise<{
  reference: string;
  amount?: number;
  status: "PAID" | "PENDING" | "UNKNOWN";
  raw: unknown;
} | null> {
  const token = await getVietQRToken();
  const res = await fetch(`${baseUrl()}/vqr/bank/api/transaction-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reference: ref }),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VietQR transaction-sync failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const raw = await res.json();
  const data = raw as {
    reference?: string;
    amount?: number;
    status?: string;
    data?: { reference?: string; amount?: number; status?: string };
  };
  const row = data.data ?? data;
  const statusRaw = String(row.status ?? "").toUpperCase();
  const status =
    statusRaw === "PAID" || statusRaw === "SUCCESS" || statusRaw === "COMPLETED"
      ? ("PAID" as const)
      : statusRaw === "PENDING" || statusRaw === "WAITING"
        ? ("PENDING" as const)
        : ("UNKNOWN" as const);

  return {
    reference: String(row.reference ?? ref),
    amount: typeof row.amount === "number" ? row.amount : undefined,
    status,
    raw,
  };
}

/** Test helper — clear cached token between suites. */
export function resetVietQRTokenCache() {
  cached = null;
}
