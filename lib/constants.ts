import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// ─── Network ──────────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? ""
);

export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as
  | "devnet"
  | "mainnet-beta";

export const RPC_URL =
  NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : clusterApiUrl("devnet");

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── PDA Seeds ────────────────────────────────────────────────────────────────

export const PLATFORM_CONFIG_SEED = Buffer.from("platform_config");
export const DROP_SEED = Buffer.from("drop");
export const VAULT_SEED = Buffer.from("vault");
export const CLAIM_SEED = Buffer.from("claim");

// ─── Platform ─────────────────────────────────────────────────────────────────

export const PLATFORM_FEE_BPS = 100; // 1%

// Byte offset of fee_wallet inside PlatformConfig:
// 8 (discriminator) + 32 (authority) = 40
export const PLATFORM_CONFIG_FEE_WALLET_OFFSET = 40;

// ─── Claim message ────────────────────────────────────────────────────────────
// Must stay in sync with SIGNATURE_MESSAGE_PREFIX in constants.rs

export const CLAIM_MESSAGE_PREFIX = "FairDrop-claim:";

// ─── Account sizes — must match Rust LEN constants ───────────────────────────

export const DROP_ACCOUNT_SIZE = 125; // Drop::LEN
export const CLAIM_RECORD_ACCOUNT_SIZE = 89;  // ClaimRecord::LEN

// ─── Instruction discriminators — sha256("global:<name>")[0..8] ──────────────
// These are fixed for a deployed program and must never change.

export const DISC_CREATE_DROP = new Uint8Array([157, 142, 145, 247, 92, 73, 59, 48]);
export const DISC_CLAIM_DROP = new Uint8Array([157, 29, 89, 14, 81, 203, 107, 58]);
export const DISC_CANCEL_DROP = new Uint8Array([78, 206, 101, 116, 70, 101, 44, 238]);
export const DISC_CLOSE_DROP = new Uint8Array([179, 36, 175, 45, 105, 230, 234, 147]);

// ─── Solscan ──────────────────────────────────────────────────────────────────

export const SOLSCAN_CLUSTER = NETWORK === "mainnet-beta" ? "" : `?cluster=${NETWORK}`;
