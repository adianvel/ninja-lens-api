import {
  chainGrpcBankApi,
  indexerGrpcDerivativesApi,
  indexerGrpcAccountApi,
  getEthereumAddress,
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
    const ethAddress = getEthereumAddress(address);
    const subaccountId = ethAddress.toLowerCase() + "0".repeat(24);

    const [bankBalances, subaccountBalances, derivativePositions] = await Promise.all([
      this.fetchBankBalances(address),
      this.fetchSubaccountBalances(subaccountId),
      this.fetchDerivativePositions(subaccountId),
    ]);

    // Merge bank + subaccount balances by denom
    const mergedBalances = this.mergeBalances(bankBalances, subaccountBalances);

    const totalBalanceValueUsd = mergedBalances.reduce((sum, b) => sum + b.valueUsd, 0);
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
      balances: mergedBalances,
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

  private mergeBalances(
    bankBalances: PortfolioBalance[],
    subaccountBalances: PortfolioBalance[]
  ): PortfolioBalance[] {
    const balanceMap = new Map<string, PortfolioBalance>();

    // Add bank balances
    for (const b of bankBalances) {
      balanceMap.set(b.denom, { ...b });
    }

    // Merge subaccount balances
    for (const sb of subaccountBalances) {
      const existing = balanceMap.get(sb.denom);
      if (existing) {
        const totalHuman = parseFloat(existing.amountHuman) + parseFloat(sb.amountHuman);
        existing.amountHuman = totalHuman.toString();
        existing.valueUsd = existing.valueUsd + sb.valueUsd;
      } else {
        balanceMap.set(sb.denom, { ...sb });
      }
    }

    const merged = Array.from(balanceMap.values());
    merged.sort((a, b) => b.valueUsd - a.valueUsd);
    return merged;
  }

  private async fetchBankBalances(address: string): Promise<PortfolioBalance[]> {
    const { balances } = await chainGrpcBankApi.fetchBalances(address);
    const priceMap = await this.getPriceMap();
    const portfolioBalances: PortfolioBalance[] = [];

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

    return portfolioBalances;
  }

  private async fetchSubaccountBalances(subaccountId: string): Promise<PortfolioBalance[]> {
    try {
      const balances = await indexerGrpcAccountApi.fetchSubaccountBalancesList(subaccountId);
      const priceMap = await this.getPriceMap();
      const portfolioBalances: PortfolioBalance[] = [];

      for (const balance of balances) {
        const denom = balance.denom || "";
        const deposit = balance.deposit;
        if (!deposit) continue;

        // totalBalance = availableBalance + usedBalance (in orders/positions)
        const totalRaw = parseFloat(deposit.totalBalance || "0");
        if (totalRaw <= 0) continue;

        const meta = resolveDenom(denom);
        const amountHuman = (totalRaw / Math.pow(10, meta.decimals)).toString();
        const priceUsd = priceMap.get(denom) || 0;
        const valueUsd = parseFloat(amountHuman) * priceUsd;

        portfolioBalances.push({
          denom,
          symbol: meta.symbol,
          amount: totalRaw.toString(),
          amountHuman,
          valueUsd,
        });
      }

      return portfolioBalances;
    } catch (error: any) {
      console.error("Failed to fetch subaccount balances:", error?.message || error);
      return [];
    }
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

  private async fetchDerivativePositions(subaccountId: string): Promise<DerivativePosition[]> {
    try {
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
      console.error("Failed to fetch derivative positions:", error);
      return [];
    }
  }
}

export const portfolioService = new PortfolioService();
