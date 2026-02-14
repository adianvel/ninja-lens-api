import { indexerGrpcSpotApi, indexerGrpcDerivativesApi } from "../config/injective";
import { cached } from "../utils/cache";
import { MarketAnalytics } from "../types";
import { marketService } from "./market.service";

export class AnalyticsService {
  async getMarketAnalytics(marketId: string): Promise<MarketAnalytics | null> {
    return cached(`analytics:${marketId}`, async () => {
      const market = await marketService.getMarket(marketId);
      if (!market) return null;

      const isSpot = market.type === "spot";

      try {
        const orderbook = isSpot
          ? await indexerGrpcSpotApi.fetchOrderbookV2(marketId)
          : await indexerGrpcDerivativesApi.fetchOrderbookV2(marketId);

        const bids = orderbook.buys || [];
        const asks = orderbook.sells || [];

        // Top of book
        const topBidPrice = bids.length > 0 ? parseFloat(bids[0].price || "0") : 0;
        const topAskPrice = asks.length > 0 ? parseFloat(asks[0].price || "0") : 0;
        const midPrice = topBidPrice > 0 && topAskPrice > 0
          ? (topBidPrice + topAskPrice) / 2
          : 0;

        // Spread
        const spreadPercent =
          midPrice > 0 ? ((topAskPrice - topBidPrice) / midPrice) * 100 : 0;

        // Depth calculation (sum of quantity * price for each side)
        const bidDepthUsd = bids.reduce((sum: number, b: any) => {
          return sum + parseFloat(b.price || "0") * parseFloat(b.quantity || "0");
        }, 0);

        const askDepthUsd = asks.reduce((sum: number, a: any) => {
          return sum + parseFloat(a.price || "0") * parseFloat(a.quantity || "0");
        }, 0);

        // Liquidity score (0-100 scale based on depth and spread)
        const totalDepth = bidDepthUsd + askDepthUsd;
        const depthScore = Math.min(totalDepth / 1000000, 1) * 50; // Up to 50 points for depth
        const spreadScore = spreadPercent < 0.01
          ? 50
          : spreadPercent < 0.1
            ? 40
            : spreadPercent < 0.5
              ? 25
              : spreadPercent < 1
                ? 10
                : 0;
        const liquidityScore = Math.round(depthScore + spreadScore);

        return {
          marketId,
          ticker: market.ticker,
          liquidityScore,
          spreadPercent: parseFloat(spreadPercent.toFixed(4)),
          bidDepthUsd: parseFloat(bidDepthUsd.toFixed(2)),
          askDepthUsd: parseFloat(askDepthUsd.toFixed(2)),
          orderCount: {
            bids: bids.length,
            asks: asks.length,
          },
          topBidPrice: topBidPrice.toString(),
          topAskPrice: topAskPrice.toString(),
          midPrice: parseFloat(midPrice.toFixed(6)),
        };
      } catch (error) {
        console.error(`Failed to fetch analytics for ${marketId}:`, error);
        return null;
      }
    }, 15); // Cache 15 seconds
  }
}

export const analyticsService = new AnalyticsService();
