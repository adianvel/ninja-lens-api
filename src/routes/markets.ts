import { Router, Request, Response } from "express";
import { marketService } from "../services/market.service";
import { analyticsService } from "../services/analytics.service";
import { ApiResponse, MarketInfo, MarketAnalytics, MarketsQuery } from "../types";

const router = Router();

/**
 * @swagger
 * /api/v1/markets:
 *   get:
 *     summary: Get all markets with filtering and sorting
 *     description: Returns aggregated spot and derivative markets from Injective with filtering by type, search by ticker, and sorting by volume or price change. Replaces the need to fetch all markets and filter client-side.
 *     tags: [Markets]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [spot, derivative, perpetual, all]
 *         description: Filter by market type
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [volume, priceChange, ticker]
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by ticker or symbol
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const query: MarketsQuery = {
      type: (req.query.type as any) || "all",
      sort: (req.query.sort as any) || "volume",
      order: (req.query.order as any) || "desc",
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const { markets, total } = await marketService.getMarkets(query);

    const response: ApiResponse<MarketInfo[]> = {
      success: true,
      data: markets,
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        timestamp: Date.now(),
      },
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "MARKETS_FETCH_ERROR", message: error.message },
    });
  }
});

/**
 * @swagger
 * /api/v1/markets/{marketId}:
 *   get:
 *     summary: Get a single market by ID
 *     tags: [Markets]
 *     parameters:
 *       - in: path
 *         name: marketId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/:marketId", async (req: Request, res: Response) => {
  try {
    const market = await marketService.getMarket(req.params.marketId as string);

    if (!market) {
      res.status(404).json({
        success: false,
        error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
      });
      return;
    }

    const response: ApiResponse<MarketInfo> = {
      success: true,
      data: market,
      meta: { timestamp: Date.now() },
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "MARKET_FETCH_ERROR", message: error.message },
    });
  }
});

/**
 * @swagger
 * /api/v1/markets/{marketId}/analytics:
 *   get:
 *     summary: Get computed analytics for a market
 *     description: Returns computed metrics including liquidity score (0-100), spread analysis, orderbook depth in USD, and order counts. These derived metrics are not available from the raw Injective API.
 *     tags: [Markets]
 *     parameters:
 *       - in: path
 *         name: marketId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/:marketId/analytics", async (req: Request, res: Response) => {
  try {
    const analytics = await analyticsService.getMarketAnalytics(req.params.marketId as string);

    if (!analytics) {
      res.status(404).json({
        success: false,
        error: { code: "ANALYTICS_NOT_FOUND", message: "Market not found or no analytics available" },
      });
      return;
    }

    const response: ApiResponse<MarketAnalytics> = {
      success: true,
      data: analytics,
      meta: { timestamp: Date.now() },
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "ANALYTICS_FETCH_ERROR", message: error.message },
    });
  }
});

export default router;
