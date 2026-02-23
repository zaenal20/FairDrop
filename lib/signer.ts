import nacl          from "tweetnacl";
import bs58          from "bs58";
import { PublicKey } from "@solana/web3.js";
import { buildClaimMessage } from "./program";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClaimToken {
  timestamp:      number;
  fairscaleScore: number;
  signature:      string; // base58
  backendPubkey:  string; // base58
}

// ─── Keypair loader ───────────────────────────────────────────────────────────

function loadBackendKeypair(): nacl.SignKeyPair {
  const secret = process.env.BACKEND_KEYPAIR_SECRET;
  if (!secret) throw new Error("BACKEND_KEYPAIR_SECRET is not set");
  return nacl.sign.keyPair.fromSecretKey(bs58.decode(secret));
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Sign a claim token. Called only from /api/claim-token (server-side).
 * The resulting ClaimToken is passed to buildClaimTransaction on the client,
 * which uses it for Ed25519Program on-chain verification.
 */
export function signClaimToken(
  dropId:         Uint8Array,
  claimerPubkey:  Uint8Array,
  fairscaleScore: number,
): ClaimToken {
  const keypair   = loadBackendKeypair();
  const timestamp = Math.floor(Date.now() / 1000);

  // buildClaimMessage is the single source of truth for the 96-byte message layout
  const message = buildClaimMessage(
    Array.from(dropId),
    new PublicKey(claimerPubkey),
    timestamp,
    fairscaleScore,
  );

  const signature = nacl.sign.detached(message, keypair.secretKey);

  return {
    timestamp,
    fairscaleScore,
    signature:     bs58.encode(signature),
    backendPubkey: bs58.encode(keypair.publicKey),
  };
}
