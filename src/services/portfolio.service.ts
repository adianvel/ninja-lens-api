import {
  chainGrpcBankApi,
  indexerGrpcDerivativesApi,
} from "../config/injective";
import { cached } from "../utils/cache";
import { resolveDenom, toHumanAmount } from "../utils/denom";
import { tokenService } from "./token.service";
import { marketService } from "./market.service";
import {
  PortfolioResponse,
  PortfolioBalance,
  DerivativePosition,
} from "../types";

export class PortfolioService {
  async getPortfolio(address: string): Promise<PortfolioResponse> {
    // Don't cache errors — let them propagate
    // Bank balances can throw on invalid address, so do it first
    const [bankBalances, derivativePositions] = await Promise.all([
      this.fetchBankBalances(address),
      this.fetchDerivativePositions(address),
    ]);

    const totalBalanceValueUsd = bankBalances.reduce((sum, b) => sum + b.valueUsd, 0);
    const totalUnrealizedPnl = derivativePositions.reduce(
      (sum, p) => sum + p.unrealizedPnl,
      0
    );
    const totalPositionsValueUsd = derivativePositions.reduce(
      (sum, p) => sum + parseFloat(p.margin),
      0
    );

    return {
      address,
      totalValueUsd: totalBalanceValueUsd + totalPositionsValueUsd,
      balances: bankBalances,
      derivativePositions,
      summary: {
        totalBalanceValueUsd,
        totalPositionsValueUsd,
        totalUnrealizedPnl,
        positionsCount: derivativePositions.length,
      },
      timestamp: Date.now(),
    };
  }

  private async fetchBankBalances(address: string): Promise<PortfolioBalance[]> {
    const { balances } = await chainGrpcBankApi.fetchBalances(address);
    const portfolioBalances: PortfolioBalance[] = [];

    // Build price map from known denoms (lightweight, no extra API calls)
    const priceMap = await this.getPriceMap();

    for (const balance of balances) {
      const denom = balance.denom;
      const amount = balance.amount;
      const meta = resolveDenom(denom);
      const amountHuman = toHumanAmount(amount, meta.decimals);
      const priceUsd = priceMap.get(denom) || 0;
      const valueUsd = parseFloat(amountHuman) * priceUsd;

      portfolioBalances.push({
        denom,
        symbol: meta.symbol,
        amount,
        amountHuman,
        valueUsd,
      });
    }

    // Sort by USD value descending
    portfolioBalances.sort((a, b) => b.valueUsd - a.valueUsd);
    return portfolioBalances;
  }

  private async getPriceMap(): Promise<Map<string, number>> {
    return cached("portfolio:priceMap", async () => {
      try {
        const allTokens = await tokenService.getAllTokens();
        return new Map(allTokens.map((t) => [t.denom, t.priceUsd]));
      } catch {
        return new Map<string, number>();
      }
    }, 60);
  }

  private async fetchDerivativePositions(address: string): Promise<DerivativePosition[]> {
    try {
      // Get default subaccount (index 0)
      const subaccountId = address + "0".repeat(24);

      const { positions } = await indexerGrpcDerivativesApi.fetchPositionsV2({
        subaccountId,
      });

      const derivativePositions: DerivativePosition[] = [];

      for (const pos of positions) {
        const marketId = pos.marketId || "";
        const marketInfo = await marketService.getMarket(marketId);

        const entryPrice = parseFloat(pos.entryPrice || "0");
        const markPrice = parseFloat(pos.markPrice || "0");
        const quantity = parseFloat(pos.quantity || "0");
        const isLong = pos.direction === "long";

        // Calculate unrealized PnL
        let unrealizedPnl = 0;
        if (entryPrice > 0 && markPrice > 0) {
          unrealizedPnl = isLong
            ? (markPrice - entryPrice) * quantity
            : (entryPrice - markPrice) * quantity;
        }

        const unrealizedPnlPercent =
          entryPrice > 0 ? (unrealizedPnl / (entryPrice * quantity)) * 100 : 0;

        derivativePositions.push({
          marketId,
          marketName: marketInfo?.ticker || marketId,
          ticker: marketInfo?.ticker || "Unknown",
          direction: pos.direction || "unknown",
          quantity: pos.quantity || "0",
          entryPrice: pos.entryPrice || "0",
          markPrice: pos.markPrice || "0",
          margin: pos.margin || "0",
          unrealizedPnl,
          unrealizedPnlPercent,
        });
      }

      return derivativePositions;
    } catch (error) {
      console.error(`Failed to fetch derivative positions for ${address}:`, error);
      return [];
    }
  }
}

export const portfolioService = new PortfolioService();
