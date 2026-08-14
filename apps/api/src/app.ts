import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { listingsRouter } from "./routes/listings";
import { productsRouter } from "./routes/products";
import { bookingsRouter } from "./routes/bookings";
import { ordersRouter } from "./routes/orders";
import { communityRouter } from "./routes/community";
import { archiveRouter } from "./routes/archive";
import { providersRouter } from "./routes/providers";

/**
 * Accepts an origin with or without a scheme.
 *
 * Render's blueprint wiring (`fromService … property: host`) supplies a
 * bare hostname, but the browser sends a full origin, so a bare value would
 * silently never match and every request would fail CORS. Assume https for
 * anything that isn't obviously local.
 */
function normalizeOrigin(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
  return `${isLocal ? "http" : "https"}://${value}`;
}

export function createApp() {
  const app = express();

  const corsOrigin = normalizeOrigin(process.env.CORS_ORIGIN ?? "http://localhost:5173");
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/listings", listingsRouter);
  app.use("/products", productsRouter);
  app.use("/bookings", bookingsRouter);
  app.use("/orders", ordersRouter);
  app.use("/community", communityRouter);
  app.use("/archive", archiveRouter);
  app.use("/providers", providersRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  });

  // Centralized error handler — every route above can just throw/reject.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on our end." });
  });

  return app;
}
