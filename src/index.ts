import express from "express";
import cors from "cors";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import healthRouter from "./routes/health";
import tokensRouter from "./routes/tokens";
import marketsRouter from "./routes/markets";
import portfolioRouter from "./routes/portfolio";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (logo, favicon)
app.use("/public", express.static("public"));

// Swagger configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Ninja Lens API",
      version: "1.0.0",
      description: `
## A single lens to see everything on Injective

Ninja Lens API is a unified REST API that aggregates, computes, and simplifies access to Injective blockchain data.

### Problem
Developers building on Injective face significant friction:
- **12+ API calls** to understand a single wallet's portfolio
- **No pre-computed PnL** — must reconstruct from raw trade history
- **Cryptic denom hashes** — \`peggy0xdAC17...\` instead of "USDT"
- **No market screener** — must fetch all markets and filter client-side
- **gRPC-first** — web developers must deal with protobuf setup

### Solution
Ninja Lens wraps Injective's gRPC APIs into clean REST endpoints with:
- **Unified portfolio** in 1 call (balances + positions + PnL)
- **Market discovery** with filtering, sorting, and search
- **Token resolution** from cryptic denoms to human-readable info
- **Computed analytics** (liquidity score, spread, depth)
- **In-memory caching** to handle rate limits gracefully
      `,
      contact: {
        name: "Ninja Lens API",
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Local development server",
      },
    ],
    tags: [
      { name: "Portfolio", description: "Unified wallet/portfolio endpoints" },
      { name: "Markets", description: "Market discovery, filtering, and analytics" },
      { name: "Tokens", description: "Token metadata and denom resolution" },
      { name: "System", description: "Health and status endpoints" },
    ],
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { background: #0D0D0D; padding: 8px 0; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .topbar-wrapper { display: flex; align-items: center; }
    .swagger-ui .topbar-wrapper .link { display: flex; align-items: center; }
    .swagger-ui .topbar-wrapper img { height: 48px; }
    .swagger-ui .topbar-wrapper .link::after { content: "Ninja Lens API"; color: #00F2FE; font-size: 20px; font-weight: 700; margin-left: 12px; letter-spacing: 2px; }
  `,
  customSiteTitle: "Ninja Lens API Docs",
  customfavIcon: "/public/favicon.svg",
  customCssUrl: undefined,
  swaggerOptions: {
    displayRequestDuration: true,
  },
}));

// Swagger JSON
app.get("/openapi.json", (_req, res) => {
  res.json(swaggerSpec);
});

// Routes
app.use("/health", healthRouter);
app.use("/api/v1/tokens", tokensRouter);
app.use("/api/v1/markets", marketsRouter);
app.use("/api/v1/portfolio", portfolioRouter);

// Root redirect to docs
app.get("/", (_req, res) => {
  res.redirect("/docs");
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found. Visit /docs for API documentation.",
    },
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An internal error occurred.",
    },
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         🥷 Ninja Lens API v1.0.0         ║
  ║                                          ║
  ║  API:  http://localhost:${PORT}             ║
  ║  Docs: http://localhost:${PORT}/docs        ║
  ║                                          ║
  ║  A single lens to see everything         ║
  ║  on Injective                            ║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
