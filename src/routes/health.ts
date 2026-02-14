import { Router, Request, Response } from "express";
import { getCacheStats } from "../utils/cache";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is healthy
 */
router.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Ninja Lens API",
    version: "1.0.0",
    uptime: process.uptime(),
    cache: getCacheStats(),
    timestamp: Date.now(),
  });
});

export default router;
