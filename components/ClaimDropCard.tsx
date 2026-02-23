"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { hasClaimed, buildClaimTransaction, fetchClaimHistory, timeAgo, type ClaimHistoryItem } from "@/lib/program";
import type { ClaimToken } from "@/lib/signer";
import { NETWORK } from "@/lib/constants";
import clsx from "clsx";
import { useToast } from "@/lib/toast";
import DynamicWalletButton from "./DynamicWalletButton";

interface DropData {
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
  isActive: boolean;
}

type ClaimStatus =
  | "idle" | "checking" | "eligible" | "ineligible"
  | "claiming" | "claimed" | "already_claimed" | "inactive";

function shortAddr(addr: string) { return `${addr.slice(0, 4)}…${addr.slice(-4)}`; }

const SOLSCAN_CLUSTER = NETWORK === "mainnet-beta" ? "" : `?cluster=${NETWORK}`;

export default function ClaimDropCard({ dropAddress, slug }: { dropAddress: string; slug: string }) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();

  const [drop, setDrop] = useState<DropData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [claimToken, setClaimToken] = useState<ClaimToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fairscore, setFairscore] = useState<number | null>(null);
  const [txSig, setTxSig] = useState("");
  const [history, setHistory] = useState<ClaimHistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Fetch drop info + claim history
  useEffect(() => {
    fetch(`/api/drop/${dropAddress}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setStatus("inactive");
        else { setDrop(data); if (!data.isActive) setStatus("inactive"); }
      })
      .catch(() => setStatus("inactive"))
      .finally(() => setLoading(false));

    // Fetch history regardless of active state
    setHistLoading(true);
    fetchClaimHistory(dropAddress)
      .then(setHistory)
      .catch(() => { })
      .finally(() => setHistLoading(false));
  }, [dropAddress]);

  // Check eligibility when wallet connects
  useEffect(() => {
    if (!publicKey || !drop || !drop.isActive) return;
    setStatus("checking");
    setError(null);

    (async () => {
      const claimed = await hasClaimed(new PublicKey(drop.address), publicKey);
      if (claimed) { setStatus("already_claimed"); return; }

      const res = await fetch("/api/claim-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropAddress: drop.address, claimer: publicKey.toString(), slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) { setFairscore(data.actual ?? 0); setStatus("ineligible"); }
        else { setError(data.error ?? "Failed to check eligibility"); setStatus("idle"); }
        return;
      }
      setClaimToken(data.claimToken);
      setFairscore(data.claimToken.fairscaleScore);
      setStatus("eligible");
    })().catch(err => { setError(err.message); setStatus("idle"); });
  }, [publicKey, drop]);

  const handleClaim = useCallback(async () => {
    if (!publicKey || !drop || !claimToken) return;
    setError(null);
    setStatus("claiming");
    try {
      const tx = await buildClaimTransaction(
        { ...drop, giveawayId: drop.dropId } as any,
        publicKey, claimToken,
      );
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: true, preflightCommitment: "confirmed",
      });
      await connection.confirmTransaction(sig, "confirmed");
      setTxSig(sig);
      setStatus("claimed");
      toast("Successfully claimed!", "success");
      fetchClaimHistory(dropAddress).then(setHistory).catch(() => { });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setError(msg);
      toast(msg, "error");
      setStatus("eligible");
    }
  }, [publicKey, drop, claimToken, sendTransaction, connection, dropAddress, toast]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
    </div>
  );

  const displayAmount = drop
    ? drop.isNativeSol
      ? `${(Number(drop.amountPerClaim) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      : `${Number(drop.amountPerClaim) / 1_000_000} USDC`
    : "";

  // ── Claimed ─────────────────────────────────────────────────────────────────
  if (status === "claimed") return (
    <div className="space-y-6 animate-fade-up" style={{ animationFillMode: "forwards" }}>
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center">
          <span className="text-3xl">✓</span>
        </div>
        <div>
          <h2 className="font-display text-3xl font-bold text-text">Claimed!</h2>
          <p className="text-accent font-mono font-bold text-lg mt-1">{displayAmount}</p>
          <p className="text-muted font-body text-sm mt-1">has been sent to your wallet</p>
        </div>
        {txSig && (
          <a href={`https://solscan.io/tx/${txSig}${SOLSCAN_CLUSTER}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-block text-xs font-mono text-accent/60 hover:text-accent transition-colors">
            View on Solscan ↗
          </a>
        )}
      </div>
      <ClaimHistorySection history={history} loading={histLoading} isNativeSol={drop?.isNativeSol ?? true} />
    </div>
  );

  // ── Inactive / not found ────────────────────────────────────────────────────
  if (!drop || status === "inactive") return (
    <div className="space-y-6">
      <div className="text-center py-10 bg-surface border border-border rounded-2xl">
        <div className="text-4xl mb-4">🙊</div>
        <h2 className="font-display text-xl font-bold text-text">Drop Ended</h2>
        <p className="text-muted font-body text-sm mt-2">
          All slots have been claimed or this drop is no longer active.
        </p>
      </div>
      {/* Still show claim history even if drop is inactive */}
      <ClaimHistorySection history={history} loading={histLoading} isNativeSol={true} />
    </div>
  );

  const filledPct = Math.round((drop.currentClaims / drop.maxClaims) * 100);

  return (
    <div className="space-y-5 animate-fade-up" style={{ animationFillMode: "forwards" }}>
      {/* Amount card */}
      <div className="text-center py-6 bg-surface border border-border rounded-2xl">
        <div className="text-4xl mb-4">🎁</div>
        <p className="font-body text-muted text-sm mb-1">You'll receive</p>
        <p className="font-display text-4xl font-bold text-accent">{displayAmount}</p>
        {drop.minFairscaleScore > 0 && (
          <p className="font-body text-xs text-muted mt-2">
            Requires FairScale score ≥ <span className="text-text font-mono">{drop.minFairscaleScore}</span>
          </p>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted">{drop.currentClaims} claimed</span>
          <span className="text-muted">{drop.remainingClaims} left</span>
        </div>
        <div className="h-2 bg-surface border border-border rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${filledPct}%` }} />
        </div>
      </div>

      {/* FairScale badge */}
      {fairscore !== null && (
        <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
          <span className="font-body text-sm text-muted">Your FairScale Score</span>
          <span className={clsx(
            "font-mono font-bold text-sm px-3 py-1 rounded-full",
            fairscore >= (drop.minFairscaleScore || 0)
              ? "bg-accent/10 text-accent border border-accent/20"
              : "bg-red-400/10 text-red-400 border border-red-400/20",
          )}>
            {fairscore}
          </span>
        </div>
      )}

      {/* Status messages */}
      {status === "already_claimed" && (
        <p className="text-center font-body text-muted text-sm bg-surface border border-border rounded-xl py-4">
          You've already claimed this drop.
        </p>
      )}
      {status === "ineligible" && (
        <p className="text-center font-body text-sm bg-red-400/5 border border-red-400/20 text-red-400 rounded-xl py-4 px-4">
          Your FairScale score ({fairscore}) is below the minimum ({drop.minFairscaleScore}).
        </p>
      )}
      {error && (
        <p className="font-body text-red-400 text-sm bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* CTA */}
      {!connected ? (
        <DynamicWalletButton style={{
          width: "100%", background: "#F97316", borderRadius: "12px",
          fontSize: "14px", fontFamily: "'DM Sans'", height: "52px",
        }} />
      ) : status === "checking" ? (
        <button disabled className="w-full py-4 rounded-xl bg-accent/20 text-accent font-display font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          Checking eligibility…
        </button>
      ) : status === "eligible" ? (
        <button onClick={handleClaim}
          className="w-full py-4 rounded-xl bg-accent text-bg font-display font-bold text-sm hover:bg-accent/90 transition-all active:scale-[0.98]">
          Claim {displayAmount} →
        </button>
      ) : status === "claiming" ? (
        <button disabled className="w-full py-4 rounded-xl bg-accent/20 text-accent font-display font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
          <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          Claiming…
        </button>
      ) : null}

      {/* Claim history */}
      <ClaimHistorySection
        history={history}
        loading={histLoading}
        isNativeSol={drop.isNativeSol}
      />
    </div>
  );
}

// ─── Claim History Section ────────────────────────────────────────────────────

function ClaimHistorySection({
  history, loading, isNativeSol,
}: {
  history: ClaimHistoryItem[];
  loading?: boolean;
  isNativeSol: boolean;
}) {
  if (loading) return (
    <div className="pt-4 flex justify-center">
      <div className="w-4 h-4 border border-border border-t-muted rounded-full animate-spin" />
    </div>
  );

  if (history.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <h3 className="font-display text-xs font-bold text-muted uppercase tracking-widest">
        Claimed by ({history.length})
      </h3>
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {history.map((item, i) => {
          const amount = isNativeSol
            ? `${(Number(item.amount) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
            : `${(Number(item.amount) / 1_000_000).toFixed(2)} USDC`;

          const solscanUrl = item.txSig
            ? `https://solscan.io/tx/${item.txSig}${SOLSCAN_CLUSTER}`
            : `https://solscan.io/account/${item.claimer}${SOLSCAN_CLUSTER}`;

          return (
            <div key={i}
              className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 text-xs">
              <span className="font-mono text-muted shrink-0 whitespace-nowrap">
                {timeAgo(item.claimedAt)}
              </span>
              <span className="font-mono text-text">{shortAddr(item.claimer)}</span>
              <span className="font-mono text-accent ml-auto shrink-0">{amount}</span>
              <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
                title="View TX on Solscan"
                className="text-muted hover:text-accent transition-colors shrink-0">
                ↗
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
