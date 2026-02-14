import { Router, Request, Response } from "express";
import { portfolioService } from "../services/portfolio.service";
import { ApiResponse, PortfolioResponse } from "../types";

const router = Router();

/**
 * @swagger
 * /api/v1/portfolio/{address}:
 *   get:
 *     summary: Get unified portfolio for an Injective address
 *     description: |
 *       Returns a complete portfolio view for any Injective address in a single API call.
 *       This replaces 12+ separate API calls that developers normally need to make:
 *       - Bank balances (all token holdings)
 *       - Derivative positions with unrealized PnL
 *       - Portfolio summary with total USD values
 *
 *       Each balance includes human-readable amounts and USD valuations.
 *       Each derivative position includes computed unrealized PnL and percentage.
 *     tags: [Portfolio]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Injective address (inj1...)
 *         example: inj1...
 */
router.get("/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    // Validate address format
    if (!address.startsWith("inj1") || address.length < 40) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ADDRESS",
          message: "Invalid Injective address. Must start with 'inj1' and be at least 40 characters.",
        },
      });
      return;
    }

    const portfolio = await portfolioService.getPortfolio(address);

    const response: ApiResponse<PortfolioResponse> = {
      success: true,
      data: portfolio,
      meta: {
        cached: true,
        timestamp: Date.now(),
      },
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "PORTFOLIO_FETCH_ERROR", message: error.message },
    });
  }
});

export default router;
