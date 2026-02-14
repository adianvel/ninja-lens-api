import { chainGrpcBankApi, indexerGrpcOracleApi, indexerGrpcSpotApi, indexerGrpcDerivativesApi } from "../config/injective";
import { cached } from "../utils/cache";
import { resolveDenom, toHumanAmount } from "../utils/denom";
import { TokenMeta } from "../types";

export class TokenService {
  async getAllTokens(): Promise<TokenMeta[]> {
    return cached("tokens:all", async () => {
      const [spotMarkets, derivativeMarkets, denomsMetadata] = await Promise.all([
        indexerGrpcSpotApi.fetchMarkets({}),
        indexerGrpcDerivativesApi.fetchMarkets({}),
        chainGrpcBankApi.fetchDenomsMetadata().catch(() => ({ metadatas: [] })),
      ]);

      const denomSet = new Set<string>();

      // Collect denoms from spot markets
      for (const m of spotMarkets) {
        if (m.baseDenom) denomSet.add(m.baseDenom);
        if (m.quoteDenom) denomSet.add(m.quoteDenom);
      }

      // Collect denoms from derivative markets
      for (const m of derivativeMarkets) {
        if (m.quoteDenom) denomSet.add(m.quoteDenom);
      }

      // Build token list with metadata
      const tokens: TokenMeta[] = [];

      for (const denom of denomSet) {
        const meta = resolveDenom(denom);
        const chainMeta = denomsMetadata.metadatas?.find(
          (m: any) => m.base === denom
        );

        tokens.push({
          denom,
          symbol: chainMeta?.symbol || meta.symbol,
          name: chainMeta?.name || meta.name,
          decimals: meta.decimals,
          logo: meta.logo,
          priceUsd: 0, // Will be enriched below
        });
      }

      // Try to get USD prices from spot markets (using USDT pairs)
      const priceMap = await this.buildPriceMap(spotMarkets);
      for (const token of tokens) {
        token.priceUsd = priceMap[token.denom] || 0;
      }

      return tokens;
    }, 120); // Cache 2 minutes
  }

  async getToken(denom: string): Promise<TokenMeta | null> {
    const tokens = await this.getAllTokens();
    return tokens.find((t) => t.denom === denom) || this.buildSingleToken(denom);
  }

  async getPrice(denom: string): Promise<number> {
    const tokens = await this.getAllTokens();
    const token = tokens.find((t) => t.denom === denom);
    return token?.priceUsd || 0;
  }

  private async buildPriceMap(spotMarkets: any[]): Promise<Record<string, number>> {
    const priceMap: Record<string, number> = {};

    // USDT stablecoins are ~$1
    const stablecoins = [
      "peggy0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      "peggy0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "peggy0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    ];
    for (const sc of stablecoins) {
      priceMap[sc] = 1.0;
    }

    // Find USDT-quoted markets to derive prices
    const usdtDenom = "peggy0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const usdtMarkets = spotMarkets.filter((m) => m.quoteDenom === usdtDenom);

    // Fetch recent trades from USDT markets to get last prices
    for (const market of usdtMarkets) {
      try {
        const { trades } = await indexerGrpcSpotApi.fetchTrades({
          marketId: market.marketId,
          pagination: { limit: 1 },
        });

        if (trades.length > 0) {
          const rawPrice = parseFloat(trades[0].price || "0");
          if (rawPrice > 0 && market.baseDenom) {
            // On-chain prices need decimal adjustment:
            // humanPrice = rawPrice * 10^(baseDecimals - quoteDecimals)
            const baseMeta = resolveDenom(market.baseDenom);
            const quoteMeta = resolveDenom(market.quoteDenom);
            const decimalDiff = baseMeta.decimals - quoteMeta.decimals;
            const humanPrice = rawPrice * Math.pow(10, decimalDiff);
            priceMap[market.baseDenom] = humanPrice;
          }
        }
      } catch {
        // Skip markets with fetch errors
      }
    }

    return priceMap;
  }

  private buildSingleToken(denom: string): TokenMeta {
    const meta = resolveDenom(denom);
    return {
      denom,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      logo: meta.logo,
      priceUsd: 0,
    };
  }
}

export const tokenService = new TokenService();
