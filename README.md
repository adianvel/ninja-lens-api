# Ninja Lens API

> A single lens to see everything on Injective

Ninja Lens is a unified REST API that aggregates, computes, and simplifies access to Injective blockchain data. It transforms 12+ separate gRPC calls into clean, developer-friendly REST endpoints with pre-computed analytics.

## The Problem

Developers building on Injective face significant friction:

| Pain Point | Impact |
|---|---|
| **12+ API calls to understand 1 wallet** | Must separately fetch bank balances, derivative positions, subaccount data, trade history, and manually join them |
| **No pre-computed PnL** | Must reconstruct from raw trade history, apply funding rates, calculate mark-to-market |
| **Cryptic denom hashes** | `peggy0xdAC17F958D2ee523a2206206994597C13D831ec7` instead of "USDT" |
| **No market screener** | Must fetch ALL markets then filter/sort client-side |
| **gRPC-first barrier** | Web developers must setup protobuf just to query simple data |
| **No computed analytics** | Liquidity scores, spread analysis, depth metrics don't exist |

## The Solution

Ninja Lens wraps Injective's gRPC infrastructure into clean REST endpoints:

```
12+ gRPC calls  →  1 REST call
Cryptic denoms  →  Human-readable tokens
Raw orderbooks  →  Liquidity scores
Manual PnL calc →  Pre-computed metrics
```

## API Endpoints

### Portfolio — Unified Wallet View
```
GET /api/v1/portfolio/:address
```
Returns complete portfolio in **one call**: bank balances (with USD values), derivative positions (with unrealized PnL), and summary totals.

**Example:**
```bash
curl http://localhost:3000/api/v1/portfolio/inj1cml96vmptgw99syqrrz8az79xer2pcgp0a885r
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "inj1...",
    "totalValueUsd": 15234.56,
    "balances": [
      {
        "denom": "inj",
        "symbol": "INJ",
        "amount": "5000000000000000000",
        "amountHuman": "5",
        "valueUsd": 50.00
      }
    ],
    "derivativePositions": [
      {
        "marketId": "0x...",
        "ticker": "BTC/USDT PERP",
        "direction": "long",
        "quantity": "0.1",
        "entryPrice": "42000",
        "markPrice": "43500",
        "unrealizedPnl": 150.00,
        "unrealizedPnlPercent": 3.57
      }
    ],
    "summary": {
      "totalBalanceValueUsd": 15084.56,
      "totalPositionsValueUsd": 150.00,
      "totalUnrealizedPnl": 150.00,
      "positionsCount": 1
    }
  }
}
```

### Markets — Discovery & Filtering
```
GET /api/v1/markets?type=perpetual&sort=volume&search=BTC&limit=10
```

Query parameters:
| Param | Values | Description |
|---|---|---|
| `type` | `spot`, `derivative`, `perpetual`, `all` | Filter by market type |
| `sort` | `volume`, `priceChange`, `ticker` | Sort field |
| `order` | `asc`, `desc` | Sort direction |
| `search` | string | Search by ticker/symbol |
| `limit` | number | Results per page (default: 50) |
| `offset` | number | Pagination offset |

### Market Analytics — Computed Metrics
```
GET /api/v1/markets/:marketId/analytics
```

Returns computed metrics not available from raw Injective APIs:

```json
{
  "success": true,
  "data": {
    "marketId": "0x...",
    "ticker": "INJ/USDT",
    "liquidityScore": 73,
    "spreadPercent": 0.0234,
    "bidDepthUsd": 524000.50,
    "askDepthUsd": 498000.75,
    "orderCount": { "bids": 45, "asks": 38 },
    "topBidPrice": "10.25",
    "topAskPrice": "10.28",
    "midPrice": 10.265
  }
}
```

**Liquidity Score (0-100):**
- Depth score (0-50): Based on total orderbook depth in USD
- Spread score (0-50): Based on bid-ask spread percentage

### Tokens — Denom Resolution
```
GET /api/v1/tokens
GET /api/v1/tokens/:denom
```

Resolves cryptic Injective denoms to human-readable token info with USD prices:

```bash
# Before: What is this?
peggy0xdAC17F958D2ee523a2206206994597C13D831ec7

# After: One API call
curl http://localhost:3000/api/v1/tokens/peggy0xdAC17F958D2ee523a2206206994597C13D831ec7
# → { "symbol": "USDT", "name": "Tether USD", "decimals": 6, "priceUsd": 1.0 }
```

### Health Check
```
GET /health
```

### API Documentation
```
GET /docs          # Swagger UI
GET /openapi.json  # OpenAPI spec
```

## Architecture

```
Developer App
     │
     ▼
┌─────────────────┐
│  Ninja Lens API │  ← REST/JSON, developer-friendly
├─────────────────┤
│  Cache Layer    │  ← In-memory, TTL-based (15s-120s)
├─────────────────┤
│  Aggregation    │  ← Combines multiple data sources
├─────────────────┤
│  Computation    │  ← PnL, liquidity score, analytics
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Injective APIs  │  ← Indexer gRPC + Chain gRPC
└─────────────────┘
```

**Key Design Decisions:**
- **In-memory caching** with TTL (15s for portfolio, 60s for markets, 120s for tokens) to stay under rate limits
- **Parallel fetching** — portfolio aggregates bank balances + derivative positions concurrently
- **Graceful degradation** — if a sub-query fails, partial results are returned rather than a full error
- **Service layer pattern** — clean separation between routes, services, and data access

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Injective SDK | @injectivelabs/sdk-ts v1.17.7 |
| Caching | node-cache (in-memory) |
| API Docs | Swagger / OpenAPI 3.0 |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
git clone https://github.com/YOUR_USERNAME/ninja-lens-api.git
cd ninja-lens-api
npm install
```

### Run (Development)
```bash
npm run dev
```

### Run (Production)
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t ninja-lens-api .
docker run -p 3000:3000 ninja-lens-api
```

The API will be available at `http://localhost:3000` with Swagger docs at `http://localhost:3000/docs`.

## Project Structure

```
src/
├── index.ts                  # Express app entry point
├── config/
│   └── injective.ts          # Injective SDK initialization
├── routes/
│   ├── portfolio.ts          # GET /api/v1/portfolio/:address
│   ├── markets.ts            # GET /api/v1/markets + analytics
│   ├── tokens.ts             # GET /api/v1/tokens
│   └── health.ts             # GET /health
├── services/
│   ├── portfolio.service.ts  # Portfolio aggregation + PnL
│   ├── market.service.ts     # Market discovery + enrichment
│   ├── token.service.ts      # Token registry + price resolution
│   └── analytics.service.ts  # Computed market metrics
├── utils/
│   ├── cache.ts              # In-memory caching layer
│   └── denom.ts              # Denom resolver + known tokens
└── types/
    └── index.ts              # TypeScript interfaces
```

## Data Sources

All data is sourced directly from Injective's infrastructure:
- **Indexer gRPC API** — Markets, orderbooks, trades, positions, funding rates
- **Chain gRPC API** — Bank balances, token metadata
- **Oracle API** — Price feeds

No external data providers (CoinGecko, etc.) are used. Prices are derived from actual on-chain trading activity.

## Hackathon Categories

This project spans two categories:

1. **Data Aggregation API** — Unified portfolio view, market discovery with filtering
2. **Computation/Derived Data API** — Liquidity scores, PnL calculations, spread analysis

## License

MIT
