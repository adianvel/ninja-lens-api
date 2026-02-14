const KNOWN_DENOMS: Record<string, { symbol: string; name: string; decimals: number; logo?: string }> = {
  inj: {
    symbol: "INJ",
    name: "Injective",
    decimals: 18,
    logo: "https://static.alchemyapi.io/images/assets/7226.png",
  },
  "peggy0xdAC17F958D2ee523a2206206994597C13D831ec7": {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logo: "https://static.alchemyapi.io/images/assets/825.png",
  },
  "peggy0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logo: "https://static.alchemyapi.io/images/assets/3408.png",
  },
  "peggy0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logo: "https://static.alchemyapi.io/images/assets/2396.png",
  },
  "peggy0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    logo: "https://static.alchemyapi.io/images/assets/3717.png",
  },
  "peggy0x514910771AF9Ca656af840dff83E8264EcF986CA": {
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
  },
  "peggy0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": {
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
  },
  "peggy0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0": {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
  },
  "peggy0x6B175474E89094C44Da98b954EedeAC495271d0F": {
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
  },
  // IBC tokens
  "ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9": {
    symbol: "ATOM",
    name: "Cosmos Hub",
    decimals: 6,
  },
  "ibc/DD648F5D3CDA56D0D8D8820CF703D246B9FC4007725D8B38D23A21FF1A1477E3": {
    symbol: "stINJ",
    name: "Stride Staked INJ",
    decimals: 18,
  },
};

export function resolveDenom(denom: string): { symbol: string; name: string; decimals: number; logo?: string } {
  const known = KNOWN_DENOMS[denom];
  if (known) return known;

  // Try to parse factory denoms
  if (denom.startsWith("factory/")) {
    const parts = denom.split("/");
    const tokenName = parts[parts.length - 1];
    return {
      symbol: tokenName.toUpperCase(),
      name: tokenName,
      decimals: 18,
    };
  }

  // Try to parse peggy denoms
  if (denom.startsWith("peggy0x")) {
    const addr = denom.replace("peggy", "");
    return {
      symbol: `ERC20-${addr.slice(0, 6)}`,
      name: `ERC20 Token (${addr.slice(0, 10)}...)`,
      decimals: 18,
    };
  }

  // IBC tokens
  if (denom.startsWith("ibc/")) {
    const hash = denom.replace("ibc/", "");
    return {
      symbol: `IBC-${hash.slice(0, 6)}`,
      name: `IBC Token (${hash.slice(0, 10)}...)`,
      decimals: 6,
    };
  }

  return {
    symbol: denom.toUpperCase(),
    name: denom,
    decimals: 18,
  };
}

export function toHumanAmount(amount: string, decimals: number): string {
  if (!amount || amount === "0") return "0";

  const amountStr = amount.padStart(decimals + 1, "0");
  const intPart = amountStr.slice(0, amountStr.length - decimals) || "0";
  const decPart = amountStr.slice(amountStr.length - decimals);

  const trimmedDec = decPart.replace(/0+$/, "");
  return trimmedDec ? `${intPart}.${trimmedDec}` : intPart;
}
