// ─── Known SPL tokens ─────────────────────────────────────────────────────────
// Shown as quick-pick presets in CreateDropForm.
// Mints here are devnet addresses — swap for mainnet when going live.
// To add a token: append an entry with the correct devnet/mainnet mint.

export interface KnownToken {
  symbol:  string;
  name:    string;
  mint:    string;
  logoURI: string;
}

export const KNOWN_TOKENS: KnownToken[] = [
  {
    symbol:  "USDC",
    name:    "USD Coin",
    mint:    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    symbol:  "ORCA",
    name:    "Orca Dev",
    mint:    "orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L",
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
  },
  {
    symbol:  "JUP",
    name:    "Jupiter",
    mint:    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    logoURI: "https://static.jup.ag/jup/icon.png",
  },
  {
    symbol:  "RAY",
    name:    "Raydium",
    mint:    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
];
