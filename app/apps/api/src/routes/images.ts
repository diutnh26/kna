import express, { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const imagesRouter = Router();

/**
 * Photographs for listings, products and provider profiles, uploaded by the
 * provider or an admin and served from here. The body is the image itself
 * (Content-Type image/jpeg, image/png or image/webp, at most 3 MB); the
 * bytes must match the declared type.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function sniff(buf: Buffer): (typeof TYPES)[number] | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/** Where this API is reachable from a browser, for the image's absolute URL. */
function publicBase(req: Request) {
  const configured = process.env.PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  return `${proto}://${req.get("host")}`;
}

const rawImage = express.raw({ type: [...TYPES], limit: MAX_BYTES });

function readImage(req: Request, res: Response, next: NextFunction) {
  rawImage(req, res, (err?: unknown) => {
    if (err) {
      const tooLarge = (err as { type?: string }).type === "entity.too.large";
      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? "Images can be at most 3 MB." : "Could not read that image.",
      });
    }
    next();
  });
}

imagesRouter.post("/", requireAuth, readImage, async (req: AuthedRequest, res) => {
  const mayUpload =
    req.user!.role === "ADMIN" ||
    Boolean(await prisma.provider.findUnique({ where: { userId: req.user!.id }, select: { id: true } }));
  if (!mayUpload) {
    return res.status(403).json({ error: "Only providers and admins can upload photographs." });
  }
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(415).json({ error: "Send a JPEG, PNG or WebP image as the request body." });
  }
  const type = sniff(body);
  if (!type || type !== req.get("content-type")?.split(";")[0]?.trim().toLowerCase()) {
    return res.status(415).json({ error: "That file is not the JPEG, PNG or WebP image it claims to be." });
  }
  const image = await prisma.uploadedImage.create({
    data: { ownerUserId: req.user!.id, contentType: type, size: body.length, data: new Uint8Array(body) },
    select: { id: true, contentType: true, size: true },
  });
  res.status(201).json({ ...image, url: `${publicBase(req)}/images/${image.id}` });
});

imagesRouter.get("/:id", async (req, res) => {
  const image = await prisma.uploadedImage.findUnique({ where: { id: req.params.id } });
  if (!image) return res.status(404).json({ error: "Image not found." });
  res.set({
    "Content-Type": image.contentType,
    "Content-Length": String(image.size),
    // An id never changes what it points at.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  res.end(Buffer.from(image.data));
});
