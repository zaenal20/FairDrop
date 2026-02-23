import {
  Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY, Transaction, TransactionInstruction, Ed25519Program,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import {
  PROGRAM_ID, RPC_URL,
  CLAIM_MESSAGE_PREFIX,
  DISC_CLAIM_DROP,
  DROP_ACCOUNT_SIZE, CLAIM_RECORD_ACCOUNT_SIZE,
} from "./constants";
import { getPlatformConfigPda, getDropPda, getVaultPda, getClaimRecordPda } from "./pda";
import type { ClaimToken } from "./signer";

// ─── Connection ───────────────────────────────────────────────────────────────

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

// ─── Drop account types ───────────────────────────────────────────────────────

export interface DropInfo {
  address: string;
  creator: string;
  dropId: number[];
  tokenMint: string;
  amountPerClaim: string;
  maxClaims: number;
  currentClaims: number;
  remainingClaims: number;
  minFairscaleScore: number;
  isNativeSol: boolean;
  isCanceled: boolean;
  isActive: boolean;
  isEnded: boolean;
}

// ─── Claim record types ───────────────────────────────────────────────────────

export interface ClaimHistoryItem {
  claimer: string;
  claimedAt: number; // unix seconds
  amount: string;
  txSig: string; // for Solscan TX link
}

// ─── Claim check ──────────────────────────────────────────────────────────────

export async function hasClaimed(dropPubkey: PublicKey, claimer: PublicKey): Promise<boolean> {
  const [claimRecord] = getClaimRecordPda(dropPubkey, claimer);
  return (await getConnection().getAccountInfo(claimRecord)) !== null;
}

export function buildClaimMessage(
  dropId: number[],
  claimer: PublicKey,
  timestamp: number,
  fairscaleScore: number,
): Uint8Array {
  const prefix = new TextEncoder().encode(CLAIM_MESSAGE_PREFIX);
  const prefixLen = prefix.length; // 15
  const msg = new Uint8Array(89); // 15 + 32 + 32 + 8 + 2
  const view = new DataView(msg.buffer);

  msg.set(prefix, 0);
  msg.set(new Uint8Array(dropId), prefixLen);        // 15
  msg.set(claimer.toBytes(), prefixLen + 32);        // 47
  view.setBigInt64(prefixLen + 64, BigInt(timestamp), true); // 79
  view.setUint16(prefixLen + 72, fairscaleScore, true);      // 87

  return msg;
}

// ─── Build claim transaction ──────────────────────────────────────────────────

export async function buildClaimTransaction(
  drop: DropInfo,
  claimer: PublicKey,
  claimToken: ClaimToken,
): Promise<Transaction> {
  const conn = getConnection();
  const dropPubkey = new PublicKey(drop.address);
  const [platformConfig] = getPlatformConfigPda();
  const [vault] = getVaultPda(dropPubkey);
  const [claimRecord] = getClaimRecordPda(dropPubkey, claimer);
  const creator = new PublicKey(drop.creator);

  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: bs58.decode(claimToken.backendPubkey),
    message: buildClaimMessage(drop.dropId, claimer, claimToken.timestamp, claimToken.fairscaleScore),
    signature: bs58.decode(claimToken.signature),
  });

  const ixData = new Uint8Array(8 + 8 + 2);
  const ixView = new DataView(ixData.buffer);
  ixData.set(DISC_CLAIM_DROP, 0);
  ixView.setBigInt64(8, BigInt(claimToken.timestamp), true);
  ixView.setUint16(16, claimToken.fairscaleScore, true);

  let claimerTa = PROGRAM_ID;
  let vaultTa = PROGRAM_ID;
  let tokProg = PROGRAM_ID;

  if (!drop.isNativeSol) {
    const mint = new PublicKey(drop.tokenMint);
    claimerTa = await getAssociatedTokenAddress(mint, claimer);
    vaultTa = await getAssociatedTokenAddress(mint, vault, true);
    tokProg = TOKEN_PROGRAM_ID;
  }

  const claimIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    data: Buffer.from(ixData),
    keys: [
      { pubkey: dropPubkey, isSigner: false, isWritable: true },
      { pubkey: claimRecord, isSigner: false, isWritable: true },
      { pubkey: platformConfig, isSigner: false, isWritable: false },
      { pubkey: claimer, isSigner: true, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: claimerTa, isSigner: false, isWritable: true },
      { pubkey: vaultTa, isSigner: false, isWritable: true },
      { pubkey: tokProg, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(SYSVAR_INSTRUCTIONS_PUBKEY), isSigner: false, isWritable: false },
    ],
  });

  const { blockhash } = await conn.getLatestBlockhash();
  const tx = new Transaction({ feePayer: claimer, recentBlockhash: blockhash });

  // Create claimer ATA if it doesn't exist yet (SPL only)
  if (!drop.isNativeSol) {
    const ataAccount = await conn.getAccountInfo(claimerTa);
    if (!ataAccount) {
      tx.add(createAssociatedTokenAccountInstruction(
        claimer, claimerTa, claimer, new PublicKey(drop.tokenMint),
      ));
    }
  }

  tx.add(ed25519Ix, claimIx);
  return tx;
}

// ─── Account parsing ──────────────────────────────────────────────────────────
// Drop account layout (LEN = DROP_ACCOUNT_SIZE = 125):
//   8   discriminator
//   32  creator
//   32  drop_id
//   32  token_mint
//   8   amount_per_claim (u64)
//   4   max_claims (u32)
//   4   current_claims (u32)
//   2   min_fairscale_score (u16)
//   1   is_native_sol (bool)
//   1   is_canceled (bool)
//   1   bump

function parseDropAccount(address: string, raw: Uint8Array): DropInfo | null {
  if (raw.length < DROP_ACCOUNT_SIZE) return null;

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let off = 8; // skip discriminator

  const creator = new PublicKey(raw.subarray(off, off + 32)).toBase58(); off += 32;
  const dropId = Array.from(raw.subarray(off, off + 32)); off += 32;
  const tokenMint = new PublicKey(raw.subarray(off, off + 32)).toBase58(); off += 32;
  const amountPerClaim = view.getBigUint64(off, true); off += 8;
  const maxClaims = view.getUint32(off, true); off += 4;
  const currentClaims = view.getUint32(off, true); off += 4;
  const minFairscaleScore = view.getUint16(off, true); off += 2;
  const isNativeSol = raw[off] === 1; off += 1;
  const isCanceled = raw[off] === 1;

  const remainingClaims = isCanceled ? 0 : maxClaims - currentClaims;

  return {
    address,
    creator,
    dropId,
    tokenMint,
    amountPerClaim: amountPerClaim.toString(),
    maxClaims,
    currentClaims,
    remainingClaims,
    minFairscaleScore,
    isNativeSol,
    isCanceled,
    isActive: !isCanceled && currentClaims < maxClaims,
    isEnded: !isCanceled && currentClaims >= maxClaims,
  };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function fetchDrop(dropAddress: string): Promise<DropInfo | null> {
  let pubkey: PublicKey;
  try { pubkey = new PublicKey(dropAddress); } catch { return null; }

  const account = await getConnection().getAccountInfo(pubkey);
  if (!account) return null;

  return parseDropAccount(dropAddress, new Uint8Array(account.data));
}

export async function fetchDropsByCreator(creator: PublicKey): Promise<DropInfo[]> {
  const accounts = await getConnection().getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: DROP_ACCOUNT_SIZE },
      { memcmp: { offset: 8, bytes: creator.toBase58() } }, // creator field after discriminator
    ],
  });

  const drops = accounts
    .map(({ pubkey, account }) => parseDropAccount(pubkey.toBase58(), new Uint8Array(account.data)))
    .filter((d): d is DropInfo => d !== null);

  // Sort: active → ended → canceled, then by remaining claims desc
  return drops.sort((a, b) => {
    const rank = (d: DropInfo) => d.isActive ? 0 : d.isEnded ? 1 : 2;
    return rank(a) !== rank(b)
      ? rank(a) - rank(b)
      : b.remainingClaims - a.remainingClaims;
  });
}

// ─── Claim history ────────────────────────────────────────────────────────────
// ClaimRecord layout (LEN = CLAIM_RECORD_ACCOUNT_SIZE = 89):
//   8   discriminator
//   32  drop (Pubkey)
//   32  claimer (Pubkey)
//   8   claimed_at (i64)
//   8   amount (u64)
//   1   bump

export async function fetchClaimHistory(dropAddress: string): Promise<ClaimHistoryItem[]> {
  let dropPubkey: PublicKey;
  try { dropPubkey = new PublicKey(dropAddress); } catch { return []; }

  const conn = getConnection();
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: CLAIM_RECORD_ACCOUNT_SIZE },
      { memcmp: { offset: 8, bytes: dropPubkey.toBase58() } }, // drop field
    ],
  });

  const items = await Promise.all(accounts.map(async ({ pubkey: recPubkey, account }) => {
    const bytes = new Uint8Array(account.data);
    const view = new DataView(bytes.buffer);

    const claimer = new PublicKey(bytes.subarray(40, 72)).toBase58(); // offset: 8+32=40
    const claimedAt = Number(view.getBigInt64(72, true));               // offset: 40+32=72
    const amount = view.getBigUint64(80, true).toString();           // offset: 72+8=80

    let txSig = "";
    try {
      const sigs = await conn.getSignaturesForAddress(recPubkey, { limit: 1 });
      if (sigs.length) txSig = sigs[0].signature;
    } catch { /* best effort */ }

    return { claimer, claimedAt, amount, txSig };
  }));

  return items.sort((a, b) => a.claimedAt - b.claimedAt);
}

// ─── Drop creation time ───────────────────────────────────────────────────────

export async function fetchDropCreationTime(dropAddress: string): Promise<number | null> {
  let pubkey: PublicKey;
  try { pubkey = new PublicKey(dropAddress); } catch { return null; }

  try {
    const sigs = await getConnection().getSignaturesForAddress(pubkey, { limit: 20 });
    if (!sigs.length) return null;
    return sigs[sigs.length - 1].blockTime ?? null;
  } catch {
    return null;
  }
}

// ─── Time ago ─────────────────────────────────────────────────────────────────

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 120) return "a minute ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200) return "an hour ago";
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return "a day ago";
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 1209600) return "a week ago";
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 5184000) return "a month ago";
  return `${Math.floor(diff / 2592000)} months ago`;
}
