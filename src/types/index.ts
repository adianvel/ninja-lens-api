export interface TokenMeta {
  denom: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  priceUsd: number;
}

export interface PortfolioBalance {
  denom: string;
  symbol: string;
  amount: string;
  amountHuman: string;
  valueUsd: number;
}

export interface SpotPosition {
  marketId: string;
  marketName: string;
  baseSymbol: string;
  quoteSymbol: string;
  openOrders: number;
}

export interface DerivativePosition {
  marketId: string;
  marketName: string;
  ticker: string;
  direction: string;
  quantity: string;
  entryPrice: string;
  markPrice: string;
  margin: string;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface PortfolioResponse {
  address: string;
  totalValueUsd: number;
  balances: PortfolioBalance[];
  derivativePositions: DerivativePosition[];
  summary: {
    totalBalanceValueUsd: number;
    totalPositionsValueUsd: number;
    totalUnrealizedPnl: number;
    positionsCount: number;
  };
  timestamp: number;
}

export interface MarketInfo {
  marketId: string;
  ticker: string;
  baseDenom?: string;
  quoteDenom?: string;
  baseSymbol?: string;
  quoteSymbol?: string;
  type: "spot" | "derivative" | "perpetual";
  marketStatus: string;
  minPriceTickSize: string;
  minQuantityTickSize: string;
  oracleType?: string;
  volume24h?: number;
  priceChange24h?: number;
  lastPrice?: number;
  fundingRate?: string;
  openInterest?: string;
}

export interface MarketAnalytics {
  marketId: string;
  ticker: string;
  liquidityScore: number;
  spreadPercent: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  orderCount: { bids: number; asks: number };
  topBidPrice: string;
  topAskPrice: string;
  midPrice: number;
}

export interface MarketsQuery {
  type?: "spot" | "derivative" | "perpetual" | "all";
  sort?: "volume" | "priceChange" | "ticker";
  order?: "asc" | "desc";
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    cached?: boolean;
    timestamp: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
