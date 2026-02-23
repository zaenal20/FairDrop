"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey, SystemProgram, Transaction, TransactionInstruction, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { PROGRAM_ID, APP_URL, PLATFORM_FEE_BPS, DISC_CREATE_DROP, PLATFORM_CONFIG_FEE_WALLET_OFFSET } from "@/lib/constants";
import { getPlatformConfigPda, getDropPda, getVaultPda } from "@/lib/pda";
import clsx from "clsx";
import { useToast } from "@/lib/toast";
import DynamicWalletButton from "./DynamicWalletButton";
import { KNOWN_TOKENS } from "@/lib/tokens";

type TokenType = "SOL" | "SPL";
type Step = "form" | "confirming" | "done";

interface FormState {
  tokenType: TokenType;
  tokenMint: string;
  totalAmount: string;
  maxClaims: string;
  minFairscaleScore: string;
}


// ─── Fairscale score indicator ────────────────────────────────────────────────
function FairscaleIndicator({ score }: { score: number }) {
  if (score === 0) return (
    <div className="flex items-center gap-2 text-xs text-muted font-body mt-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-5 h-1.5 rounded-full bg-border" />)}
      </div>
      <span>Open to all wallets</span>
    </div>
  );

  let bars: number;
  let color: string;
  let label: string;
  let desc: string;

  if (score < 100) {
    bars = 1; color = "bg-red-500"; label = "Very Low";
    desc = "Almost any wallet can claim, including bots";
  } else if (score < 300) {
    bars = 2; color = "bg-orange-400"; label = "Low";
    desc = "Low barrier — some bot risk";
  } else if (score < 600) {
    bars = 3; color = "bg-yellow-400"; label = "Medium";
    desc = "Decent filter — casual users and above";
  } else if (score < 850) {
    bars = 4; color = "bg-green-400"; label = "Good";
    desc = "High quality claimers, most bots filtered";
  } else {
    bars = 5; color = "bg-accent"; label = "Excellent";
    desc = "Only top-reputation wallets can claim";
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={clsx("w-5 h-1.5 rounded-full transition-colors", i <= bars ? color : "bg-border")} />
          ))}
        </div>
        <span className={clsx("text-xs font-mono font-bold",
          bars === 1 ? "text-red-500" :
            bars === 2 ? "text-orange-400" :
              bars === 3 ? "text-yellow-400" :
                bars === 4 ? "text-green-400" : "text-accent"
        )}>
          {label}
        </span>
      </div>
      <p className="text-xs text-muted font-body">{desc}</p>
    </div>
  );
}

// ─── Token name resolver — Solana Explorer API ────────────────────────────────
// cluster: 1 = mainnet-beta, 2 = devnet, 3 = testnet

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;
}

const tokenInfoCache = new Map<string, TokenInfo | null>();

async function fetchTokenInfo(mint: string, network: string): Promise<TokenInfo | null> {
  const cacheKey = `${mint}:${network}`;
  if (tokenInfoCache.has(cacheKey)) return tokenInfoCache.get(cacheKey)!;

  try {
    // Proxy through our own API route to avoid CORS
    const res = await fetch(`/api/token-info?mint=${encodeURIComponent(mint)}&network=${network}`);
    if (!res.ok) { tokenInfoCache.set(cacheKey, null); return null; }
    const data = await res.json();
    if (data.error) { tokenInfoCache.set(cacheKey, null); return null; }
    const info: TokenInfo = {
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      logoURI: data.logoURI,
      verified: data.verified,
    };
    tokenInfoCache.set(cacheKey, info);
    return info;
  } catch {
    tokenInfoCache.set(cacheKey, null);
    return null;
  }
}

function useTokenName(mint: string) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mint || mint.length < 32) { setTokenInfo(null); return; }

    // Check presets first (no network call needed)
    const known = KNOWN_TOKENS.find(t => t.mint === mint);
    if (known) {
      setTokenInfo({ name: known.name, symbol: known.symbol, decimals: 6, verified: true });
      return;
    }

    // Validate base58
    try { new PublicKey(mint); } catch { setTokenInfo(null); return; }

    setLoading(true);
    fetchTokenInfo(mint, process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet")
      .then(setTokenInfo)
      .catch(() => setTokenInfo(null))
      .finally(() => setLoading(false));
  }, [mint]);

  const name = tokenInfo ? `${tokenInfo.name} (${tokenInfo.symbol})` : null;
  return { name, tokenInfo, loading };
}

export default function CreateDropForm() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>({
    tokenType: "SOL", tokenMint: "", totalAmount: "", maxClaims: "10", minFairscaleScore: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState("");

  const totalFloat = parseFloat(form.totalAmount || "0");
  const fee = totalFloat * (PLATFORM_FEE_BPS / 10000);
  const net = totalFloat - fee;
  const maxClaimsInt = parseInt(form.maxClaims) || 0;
  const perClaim = maxClaimsInt > 0 ? (net / maxClaimsInt).toFixed(6) : "0";
  const scoreInt = parseInt(form.minFairscaleScore) || 0;

  const { name: tokenName, tokenInfo, loading: tokenNameLoading } = useTokenName(
    form.tokenType === "SPL" ? form.tokenMint : ""
  );

  const handleCreate = useCallback(async () => {
    if (!publicKey) return;
    setError(null);
    setStep("confirming");

    try {
      const dropId = new Uint8Array(32);
      window.crypto.getRandomValues(dropId);

      const [dropPda] = getDropPda(publicKey, dropId);
      const [platformConfig] = getPlatformConfigPda();
      const [vault] = getVaultPda(dropPda);

      const configInfo = await connection.getAccountInfo(platformConfig);
      if (!configInfo) throw new Error("Platform not initialized");
      const feeWallet = new PublicKey(configInfo.data.slice(PLATFORM_CONFIG_FEE_WALLET_OFFSET, PLATFORM_CONFIG_FEE_WALLET_OFFSET + 32));

      const isNativeSol = form.tokenType === "SOL";
      const totalAmountUnits = isNativeSol
        ? BigInt(Math.floor(totalFloat * LAMPORTS_PER_SOL))
        : BigInt(Math.floor(totalFloat * 1_000_000));
      const maxClaims = parseInt(form.maxClaims);
      const minFairscaleScore = parseInt(form.minFairscaleScore) || 0;

      const ixData = new Uint8Array(55);
      const dv = new DataView(ixData.buffer);
      let off = 0;
      ixData.set(DISC_CREATE_DROP, off); off += 8;
      ixData.set(dropId, off); off += 32;
      dv.setBigUint64(off, totalAmountUnits, true); off += 8;
      dv.setUint32(off, maxClaims, true); off += 4;
      dv.setUint16(off, minFairscaleScore, true); off += 2;
      ixData[off] = isNativeSol ? 1 : 0;

      const NULL = PROGRAM_ID;
      const tokenMint = isNativeSol ? NULL : new PublicKey(form.tokenMint);
      let creatorTa = NULL;
      let vaultTa = NULL;
      let feeTa = NULL;
      let tokProg = NULL;

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash });

      if (!isNativeSol) {
        const mint = new PublicKey(form.tokenMint);
        creatorTa = await getAssociatedTokenAddress(mint, publicKey);
        vaultTa = await getAssociatedTokenAddress(mint, vault, true);
        feeTa = await getAssociatedTokenAddress(mint, feeWallet);
        tokProg = TOKEN_PROGRAM_ID;

        const [vaultAtaInfo, feeAtaInfo] = await Promise.all([
          connection.getAccountInfo(vaultTa),
          connection.getAccountInfo(feeTa),
        ]);
        if (!vaultAtaInfo) tx.add(createAssociatedTokenAccountInstruction(publicKey, vaultTa, vault, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
        if (!feeAtaInfo) tx.add(createAssociatedTokenAccountInstruction(publicKey, feeTa, feeWallet, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
      }

      tx.add(new TransactionInstruction({
        programId: PROGRAM_ID,
        data: Buffer.from(ixData),
        keys: [
          { pubkey: dropPda, isSigner: false, isWritable: true },
          { pubkey: platformConfig, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: tokenMint, isSigner: false, isWritable: false },
          { pubkey: creatorTa, isSigner: false, isWritable: true },
          { pubkey: vaultTa, isSigner: false, isWritable: true },
          { pubkey: feeTa, isSigner: false, isWritable: true },
          { pubkey: feeWallet, isSigner: false, isWritable: true },
          { pubkey: tokProg, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
      }));

      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");
      // Generate slug — drop_address is not exposed in the URL
      const slugRes = await fetch("/api/create-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropAddress: dropPda.toString(), creator: publicKey.toBase58() }),
      });
      const { slug } = await slugRes.json();
      setClaimLink(`${APP_URL}/claim/${slug}`);
      setStep("done");
      toast("Drop created!", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setError(msg);
      toast(msg, "error");
      setStep("form");
    }
  }, [publicKey, connection, form, sendTransaction, totalFloat, toast]);

  if (step === "done") {
    return (
      <div className="animate-fade-up text-center space-y-6" style={{ animationFillMode: "forwards" }}>
        <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
          <span className="text-2xl">🎉</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-text">Drop created!</h2>
          <p className="text-muted mt-1 font-body text-sm">Share this link with your audience</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-left">
          <p className="font-mono text-xs text-accent break-all">{claimLink}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { navigator.clipboard.writeText(claimLink); toast("Copied!", "success"); }}
            className="flex-1 py-3 rounded-xl bg-accent text-bg font-display font-bold text-sm hover:bg-accent/90 transition-colors">
            Copy Link
          </button>
          <button onClick={() => { setStep("form"); setClaimLink(""); }}
            className="flex-1 py-3 rounded-xl border border-border text-muted hover:text-text font-display font-bold text-sm transition-colors">
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up" style={{ animationFillMode: "forwards" }}>
      {/* Token Type */}
      <div>
        <label className="block font-display text-xs font-bold text-muted uppercase tracking-wider mb-2">
          Token Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["SOL", "SPL"] as TokenType[]).map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, tokenType: t, tokenMint: "" }))}
              className={clsx(
                "py-3 rounded-xl font-display font-bold text-sm border transition-all",
                form.tokenType === t ? "bg-accent text-bg border-accent" : "border-border text-muted hover:border-accent/40 hover:text-text"
              )}>
              {t === "SOL" ? "◎ SOL" : "⬡ SPL Token"}
            </button>
          ))}
        </div>
      </div>

      {/* SPL Token selector */}
      {form.tokenType === "SPL" && (
        <div className="space-y-3">
          {/* Quick-pick presets */}
          <label className="block font-display text-xs font-bold text-muted uppercase tracking-wider">
            Select Token
          </label>
          <div className="grid grid-cols-4 gap-2">
            {KNOWN_TOKENS.map(t => (
              <button key={t.mint}
                onClick={() => setForm(f => ({ ...f, tokenMint: t.mint }))}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-body transition-all",
                  form.tokenMint === t.mint
                    ? "border-accent bg-accent/10 text-text"
                    : "border-border text-muted hover:border-accent/30 hover:text-text"
                )}>
                <img src={t.logoURI} alt={t.name} className="w-4 h-4 rounded-full" />
                <span className="font-mono font-bold">{t.symbol}</span>
              </button>
            ))}
          </div>

          {/* Manual mint input */}
          <div>
            <label className="block font-display text-xs font-bold text-muted uppercase tracking-wider mb-2">
              Or paste mint address
            </label>
            <input
              value={form.tokenMint}
              onChange={e => setForm(f => ({ ...f, tokenMint: e.target.value }))}
              placeholder="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-xs text-text placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
            />
            {/* Token name resolved */}
            {form.tokenMint.length > 30 && (
              <div className="mt-1.5 text-xs font-body text-muted">
                {tokenNameLoading
                  ? <span className="animate-pulse">Resolving token…</span>
                  : tokenName
                    ?
                    <div className="flex items-center gap-1">
                      {/* icon from tokenInfo */}
                      {tokenInfo?.logoURI && (
                        <img src={tokenInfo.logoURI} alt={tokenInfo.name} className="w-4 h-4" />
                      )}
                      <span className="text-green-400">✓ {tokenName}</span>
                    </div>
                    : <span className="text-red-400">Unknown or invalid mint address</span>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Total Amount */}
      <div>
        <label className="block font-display text-xs font-bold text-muted uppercase tracking-wider mb-2">
          Total Amount ({form.tokenType === "SOL" ? "SOL" : tokenName?.split("(")[1]?.replace(")", "") || "tokens"})
        </label>
        <input type="number" min="0" step="0.01"
          value={form.totalAmount}
          onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
          placeholder="0.1"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-text placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Max Claims */}
      <div>
        <label className="block font-display text-xs font-bold text-muted uppercase tracking-wider mb-2">
          Number of Winners
        </label>
        <input type="number" min="1" max="10000"
          // value={form.maxClaims}
          onChange={e => setForm(f => ({ ...f, maxClaims: e.target.value }))}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-text focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* FairScale Score */}
      <div>
        <label className="block font-display text-xs font-bold text-muted uppercase tracking-wider mb-2">
          Min FairScale Score
          <span className="ml-2 font-body normal-case text-muted/60 font-normal">(0 = open to all)</span>
        </label>
        <input type="number" min="0" max="1000"
          value={form.minFairscaleScore}
          onChange={e => setForm(f => ({ ...f, minFairscaleScore: e.target.value }))}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-text focus:outline-none focus:border-accent/50 transition-colors"
        />
        <FairscaleIndicator score={scoreInt} />
      </div>

      {/* Fee preview */}
      {totalFloat > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-body text-muted">Platform fee (1%)</span>
            <span className="font-mono text-text">{fee.toFixed(6)} {form.tokenType === "SOL" ? "SOL" : "tokens"}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="font-body text-muted">Per winner</span>
            <span className="font-mono text-accent font-bold">{perClaim} {form.tokenType === "SOL" ? "SOL" : "tokens"}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm font-body bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {!connected ? (
        <DynamicWalletButton style={{ width: "100%", background: "#F97316", borderRadius: "12px", fontSize: "14px", fontFamily: "'DM Sans'", height: "52px" }} />
      ) : (
        <button onClick={handleCreate}
          disabled={step === "confirming" || !form.totalAmount || !form.maxClaims || (form.tokenType === "SPL" && !form.tokenMint)}
          className={clsx(
            "w-full py-4 rounded-xl font-display font-bold text-sm transition-all",
            step === "confirming" || !form.totalAmount
              ? "bg-accent/30 text-accent cursor-not-allowed"
              : "bg-accent text-bg hover:bg-accent/90"
          )}>
          {step === "confirming" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Confirming…
            </span>
          ) : "Create Drop →"}
        </button>
      )}
    </div>
  );
}
