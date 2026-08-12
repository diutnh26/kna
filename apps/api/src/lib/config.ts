const DEV_JWT_SECRET = "dev-only-change-me";

export const isProduction = process.env.NODE_ENV === "production";

/**
 * Fails fast rather than booting insecurely.
 *
 * The dev fallback secret is committed to the repo, so anyone who can read
 * it can mint a token for any account — including a Committee seat-holder,
 * which is the one thing the governance model must not let an outsider
 * take. A production process must be given a real one.
 */
export function assertProductionConfig() {
  if (!isProduction) return;

  const problems: string[] = [];
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === DEV_JWT_SECRET) {
    problems.push("JWT_SECRET is unset or still the development default.");
  } else if (secret.length < 32) {
    problems.push("JWT_SECRET is shorter than 32 characters.");
  }

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is unset.");
  }

  if (!process.env.CORS_ORIGIN) {
    problems.push("CORS_ORIGIN is unset — it must name the deployed frontend, not default to localhost.");
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production:\n  - ${problems.join("\n  - ")}\n` +
        "Set these in the deployment environment and restart."
    );
  }
}
