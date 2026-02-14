import { Router, Request, Response } from "express";
import { tokenService } from "../services/token.service";
import { ApiResponse, TokenMeta } from "../types";

const router = Router();

/**
 * @swagger
 * /api/v1/tokens:
 *   get:
 *     summary: Get all known tokens with metadata and USD prices
 *     description: Returns a comprehensive list of all tokens discovered from Injective markets, including resolved denom metadata, symbols, decimals, and current USD prices.
 *     tags: [Tokens]
 *     responses:
 *       200:
 *         description: List of tokens
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const tokens = await tokenService.getAllTokens();
    const response: ApiResponse<TokenMeta[]> = {
      success: true,
      data: tokens,
      meta: {
        total: tokens.length,
        cached: true,
        timestamp: Date.now(),
      },
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "TOKEN_FETCH_ERROR", message: error.message },
    });
  }
});

/**
 * @swagger
 * /api/v1/tokens/{denom}:
 *   get:
 *     summary: Get a single token by denom
 *     description: Resolves a cryptic Injective denom (e.g. peggy0xdAC17F958D2ee523a2206206994597C13D831ec7) to human-readable token info with USD price.
 *     tags: [Tokens]
 *     parameters:
 *       - in: path
 *         name: denom
 *         required: true
 *         schema:
 *           type: string
 *         description: The token denomination string
 *     responses:
 *       200:
 *         description: Token metadata with USD price
 *       404:
 *         description: Token not found
 */
router.get("/:denom", async (req: Request, res: Response) => {
  try {
    const denom = req.params.denom as string;
    const token = await tokenService.getToken(decodeURIComponent(denom));

    if (!token) {
      res.status(404).json({
        success: false,
        error: { code: "TOKEN_NOT_FOUND", message: `Token not found: ${denom}` },
      });
      return;
    }

    const response: ApiResponse<TokenMeta> = {
      success: true,
      data: token,
      meta: { timestamp: Date.now() },
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "TOKEN_FETCH_ERROR", message: error.message },
    });
  }
});

export default router;
