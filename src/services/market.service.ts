import { indexerGrpcSpotApi, indexerGrpcDerivativesApi } from "../config/injective";
import { cached } from "../utils/cache";
import { resolveDenom } from "../utils/denom";
import { MarketInfo, MarketsQuery } from "../types";

export class MarketService {
  async getMarkets(query: MarketsQuery = {}): Promise<{ markets: MarketInfo[]; total: number }> {
    const allMarkets = await this.fetchAllMarkets();

    let filtered = [...allMarkets];

    // Filter by type
    if (query.type && query.type !== "all") {
      filtered = filtered.filter((m) => {
        if (query.type === "perpetual") return m.type === "perpetual" || m.type === "derivative";
        return m.type === query.type;
      });
    }

    // Search by ticker
    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.ticker.toLowerCase().includes(search) ||
          m.baseSymbol?.toLowerCase().includes(search) ||
          m.quoteSymbol?.toLowerCase().includes(search)
      );
    }

    // Sort
    const sortField = query.sort || "volume";
    const sortOrder = query.order || "desc";
    filtered.sort((a, b) => {
      let valA: number, valB: number;
      switch (sortField) {
        case "volume":
          valA = a.volume24h || 0;
          valB = b.volume24h || 0;
          break;
        case "priceChange":
          valA = a.priceChange24h || 0;
          valB = b.priceChange24h || 0;
          break;
        case "ticker":
          return sortOrder === "asc"
            ? a.ticker.localeCompare(b.ticker)
            : b.ticker.localeCompare(a.ticker);
        default:
          valA = a.volume24h || 0;
          valB = b.volume24h || 0;
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginated = filtered.slice(offset, offset + limit);

    return { markets: paginated, total };
  }

  async getMarket(marketId: string): Promise<MarketInfo | null> {
    const allMarkets = await this.fetchAllMarkets();
    return allMarkets.find((m) => m.marketId === marketId) || null;
  }

  private async fetchAllMarkets(): Promise<MarketInfo[]> {
    return cached("markets:all", async () => {
      const [spotMarkets, derivativeMarkets] = await Promise.all([
        indexerGrpcSpotApi.fetchMarkets({}),
        indexerGrpcDerivativesApi.fetchMarkets({}),
      ]);

      const markets: MarketInfo[] = [];

      // Process spot markets
      for (const m of spotMarkets) {
        const baseMeta = resolveDenom(m.baseDenom || "");
        const quoteMeta = resolveDenom(m.quoteDenom || "");

        markets.push({
          marketId: m.marketId,
          ticker: m.ticker || `${baseMeta.symbol}/${quoteMeta.symbol}`,
          baseDenom: m.baseDenom,
          quoteDenom: m.quoteDenom,
          baseSymbol: baseMeta.symbol,
          quoteSymbol: quoteMeta.symbol,
          type: "spot",
          marketStatus: m.marketStatus || "active",
          minPriceTickSize: String(m.minPriceTickSize || "0"),
          minQuantityTickSize: String(m.minQuantityTickSize || "0"),
          volume24h: 0,
          priceChange24h: 0,
          lastPrice: 0,
        });
      }

      // Process derivative markets
      for (const m of derivativeMarkets) {
        const quoteMeta = resolveDenom(m.quoteDenom || "");
        const isPerpetual = "isPerpetual" in m ? (m as any).isPerpetual : false;

        markets.push({
          marketId: m.marketId,
          ticker: m.ticker || "Unknown",
          quoteDenom: m.quoteDenom,
          quoteSymbol: quoteMeta.symbol,
          type: isPerpetual ? "perpetual" : "derivative",
          marketStatus: m.marketStatus || "active",
          minPriceTickSize: String(m.minPriceTickSize || "0"),
          minQuantityTickSize: String(m.minQuantityTickSize || "0"),
          oracleType: m.oracleType,
          volume24h: 0,
          priceChange24h: 0,
          lastPrice: 0,
          fundingRate: undefined,
          openInterest: undefined,
        });
      }

      // Enrich with volume data from trades (last 24h summary)
      await this.enrichWithMarketData(markets);

      return markets;
    }, 60); // Cache 1 minute
  }

  private async enrichWithMarketData(markets: MarketInfo[]): Promise<void> {
    // Fetch recent trades for top markets to get price data
    const enrichPromises = markets.slice(0, 30).map(async (market) => {
      try {
        if (market.type === "spot") {
          const { trades } = await indexerGrpcSpotApi.fetchTrades({
            marketId: market.marketId,
            pagination: { limit: 2 },
          });
          if (trades.length > 0) {
            market.lastPrice = parseFloat(trades[0].price || "0");
          }
        } else {
          const { trades } = await indexerGrpcDerivativesApi.fetchTrades({
            marketId: market.marketId,
            pagination: { limit: 2 },
          });
          if (trades.length > 0) {
            market.lastPrice = parseFloat(trades[0].executionPrice || "0");
          }

          // Fetch funding rate for perpetuals
          if (market.type === "perpetual") {
            const { fundingRates } = await indexerGrpcDerivativesApi.fetchFundingRates({
              marketId: market.marketId,
              pagination: { limit: 1 },
            });
            if (fundingRates.length > 0) {
              market.fundingRate = fundingRates[0].rate || "0";
            }
          }
        }
      } catch {
        // Non-critical, skip enrichment errors
      }
    });

    await Promise.all(enrichPromises);
  }
}

export const marketService = new MarketService();
