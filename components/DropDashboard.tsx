"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey, LAMPORTS_PER_SOL, Transaction, TransactionInstruction, SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import Link from "next/link";
import { fetchDropsByCreator, fetchDropCreationTime, type DropInfo } from "@/lib/program";
import { getCachedAuth, notifyAuthExpired } from "@/lib/wallet-auth";
import { PROGRAM_ID, APP_URL, DISC_CANCEL_DROP, DISC_CLOSE_DROP, SOLSCAN_CLUSTER } from "@/lib/constants";
import { getVaultPda } from "@/lib/pda";
import { useToast } from "@/lib/toast";
import DynamicWalletButton from "./DynamicWalletButton";
import clsx from "clsx";

const PAGE_SIZE = 6;

type StatusFilter = "all" | "active" | "ended" | "canceled";
type TokenFilter = "all" | "sol" | "spl";
type SortOption = "newest" | "oldest" | "most_claimed";

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmCloseModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-fade-up"
        style={{ animationFillMode: "forwards" }}>
        <h3 className="font-display text-lg font-bold text-text">Close Drop Account?</h3>
        <div className="space-y-2 text-sm font-body text-muted leading-relaxed">
          <p>This will permanently close the on-chain drop account and reclaim the rent (~0.0009 SOL) back to your wallet.</p>
          <p className="text-red-400/80">⚠ All claim history linked to this drop will no longer be accessible on-chain.</p>
          <p>This action is irreversible.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted font-display font-bold text-sm hover:text-text hover:border-accent/30 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-display font-bold text-sm hover:bg-red-600 transition-colors">
            Close & Reclaim
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Actions Dropdown ──────────────────────────────────────────────────

function ActionsDropdown({ claimLink, shareText, solscanUrl }: {
  claimLink: string; shareText: string; solscanUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const copyLink = () => {
    navigator.clipboard.writeText(claimLink);
    toast("Link copied!", "success");
    setOpen(false);
  };
  const shareToX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-xs font-body text-muted hover:text-text transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-accent/30">
        Actions ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-1 z-20 w-40 bg-surface border border-border rounded-xl overflow-hidden shadow-xl">
            <button onClick={copyLink}
              className="w-full text-left px-3 py-2.5 text-xs font-body text-muted hover:text-text hover:bg-bg/50 transition-colors">
              📋 Copy Link
            </button>
            <button onClick={shareToX}
              className="w-full text-left px-3 py-2.5 text-xs font-body text-muted hover:text-text hover:bg-bg/50 transition-colors">
              𝕏 Share on X
            </button>
            <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-xs font-body text-muted hover:text-text hover:bg-bg/50 transition-colors">
              🔍 Solscan ↗
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Drop Card ────────────────────────────────────────────────────────────────

function DropCard({ drop, claimSlug, onMutated }: { drop: DropInfo; claimSlug: string | null; onMutated: () => void }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();

  const [canceling, setCanceling] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  // Fetch creation time once
  useEffect(() => {
    fetchDropCreationTime(drop.address).then(t => setCreatedAt(t ?? null));
  }, [drop.address]);

  const claimLink = claimSlug ? `${APP_URL}/claim/${claimSlug}` : null;
  const solscanUrl = `https://solscan.io/account/${drop.address}${SOLSCAN_CLUSTER}`;
  const filledPct = Math.round((drop.currentClaims / drop.maxClaims) * 100);
  const isSOL = drop.isNativeSol;

  const perWinner = isSOL
    ? `${(Number(drop.amountPerClaim) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
    : `${(Number(drop.amountPerClaim) / 1_000_000).toFixed(2)} USDC`;

  const refundAmt = isSOL
    ? `${(Number(drop.amountPerClaim) * drop.remainingClaims / LAMPORTS_PER_SOL).toFixed(4)} SOL`
    : `${(Number(drop.amountPerClaim) * drop.remainingClaims / 1_000_000).toFixed(2)} USDC`;

  const shareText =
    claimLink ? `🎁 ${perWinner} per winner — ${drop.maxClaims} slots, first come first served!\nClaim here 👇\n${claimLink}\n\n#Solana #drop` : "";

  const handleCancel = useCallback(async () => {
    if (!publicKey) return;
    setCanceling(true);
    try {
      const dropPubkey = new PublicKey(drop.address);
      const [vault] = getVaultPda(dropPubkey);
      const NULL = PROGRAM_ID;
      let creatorTa = NULL;
      let vaultTa = NULL;
      let tokProg = NULL;

      if (!drop.isNativeSol) {
        const mint = new PublicKey(drop.tokenMint);
        creatorTa = await getAssociatedTokenAddress(mint, publicKey);
        vaultTa = await getAssociatedTokenAddress(mint, vault, true);
        tokProg = TOKEN_PROGRAM_ID;
      }

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        data: Buffer.from(DISC_CANCEL_DROP),
        keys: [
          { pubkey: new PublicKey(drop.address), isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: creatorTa, isSigner: false, isWritable: true },
          { pubkey: vaultTa, isSigner: false, isWritable: true },
          { pubkey: tokProg, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
      });
      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash });
      tx.add(ix);
      await connection.confirmTransaction(await sendTransaction(tx, connection), "confirmed");
      toast("Drop canceled — funds refunded!", "success");
      onMutated();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Cancel failed", "error");
    } finally {
      setCanceling(false);
    }
  }, [publicKey, drop, sendTransaction, connection, onMutated, toast]);

  const handleClose = useCallback(async () => {
    if (!publicKey) return;
    setClosing(true);
    try {
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        data: Buffer.from(DISC_CLOSE_DROP),
        keys: [
          { pubkey: new PublicKey(drop.address), isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
      });
      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash });
      tx.add(ix);
      await connection.confirmTransaction(await sendTransaction(tx, connection), "confirmed");
      toast("Rent reclaimed!", "success");
      onMutated();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Close failed", "error");
    } finally {
      setClosing(false);
    }
  }, [publicKey, drop, sendTransaction, connection, onMutated, toast]);

  // Status badge
  const badge = drop.isCanceled
    ? <span className="text-xs font-mono px-2 py-0.5 rounded-full border bg-red-400/10 text-red-400 border-red-400/20">canceled</span>
    : drop.isActive
      ? <span className="text-xs font-mono px-2 py-0.5 rounded-full border bg-accent/10 text-accent border-accent/20">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot mr-1" />active
      </span>
      : <span className="text-xs font-mono px-2 py-0.5 rounded-full border bg-muted/10 text-muted border-muted/20">ended</span>;

  return (
    <>
      {showConfirm && (
        <ConfirmCloseModal
          onConfirm={() => { setShowConfirm(false); handleClose(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className={clsx(
        "bg-surface border rounded-2xl p-4 sm:p-5 space-y-3 transition-colors",
        drop.isActive ? "border-border hover:border-accent/30" : "border-border opacity-70"
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {badge}
            <span className="text-xs font-mono text-muted">{isSOL ? "◎ SOL" : "⬡ SPL"}</span>
            {drop.minFairscaleScore > 0 && (
              <span className="text-xs font-mono text-muted border border-border rounded-full px-2 py-0.5">
                score ≥ {drop.minFairscaleScore}
              </span>
            )}
          </div>
          <span className="font-display font-bold text-accent text-sm">{perWinner} / winner</span>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-muted">
            <span>{drop.currentClaims} claimed</span>
            <span>{drop.isCanceled ? "canceled" : `${drop.remainingClaims} / ${drop.maxClaims} left`}</span>
          </div>
          <div className="h-1.5 bg-bg border border-border rounded-full overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all duration-500",
                drop.isCanceled ? "bg-red-400/50" : drop.isActive ? "bg-accent" : "bg-muted"
              )}
              style={{ width: `${filledPct}%` }}
            />
          </div>
        </div>

        {/* Created at */}
        <p className="text-xs font-mono text-muted/50">
          {createdAt ? `Created ${formatDate(createdAt)}` : drop.address}
        </p>

        {/* ── Actions ── */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">

          {/* Desktop: 3 individual buttons */}
          {drop.isActive && (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <button onClick={() => { if (!claimLink) return; navigator.clipboard.writeText(claimLink); setCopied(true); toast("Link copied!", "success"); setTimeout(() => setCopied(false), 2000); }}
                  disabled={!claimLink}
                  className="text-xs font-body text-muted hover:text-text px-3 py-1.5 rounded-lg border border-border hover:border-accent/30 transition-colors">
                  {copied ? "✓ Copied" : "Copy Link"}
                </button>
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank", "noopener")}
                  className="text-xs font-body text-muted hover:text-text px-3 py-1.5 rounded-lg border border-border hover:border-accent/30 transition-colors">
                  Share 𝕏
                </button>
                <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-body text-muted hover:text-text px-3 py-1.5 rounded-lg border border-border hover:border-accent/30 transition-colors">
                  Solscan ↗
                </a>
              </div>
              {/* Mobile: dropdown */}
              <div className="sm:hidden">
                <ActionsDropdown claimLink={claimLink ?? ""} shareText={shareText} solscanUrl={solscanUrl} />
              </div>
            </>
          )}

          {/* View + Solscan (inactive) */}
          {!drop.isActive && (
            <>
              {claimLink && (
                <Link href={claimLink}
                  className="text-xs font-body text-accent px-3 py-1.5 rounded-lg border border-accent/30 hover:bg-accent/10 transition-colors">
                  View →
                </Link>
              )}
              <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-body text-muted hover:text-text px-3 py-1.5 rounded-lg border border-border hover:border-accent/30 transition-colors">
                Solscan ↗
              </a>
            </>
          )}

          {/* Cancel */}
          {drop.isActive && drop.remainingClaims > 0 && (
            <button onClick={handleCancel} disabled={canceling}
              className={clsx(
                "text-xs font-body px-3 py-1.5 rounded-lg border transition-colors ml-auto",
                canceling ? "text-muted border-border cursor-not-allowed"
                  : "text-red-400 border-red-400/20 hover:bg-red-400/5 hover:border-red-400/40"
              )}>
              {canceling ? "Canceling…" : `Cancel & Refund ${refundAmt}`}
            </button>
          )}

          {/* Close & Reclaim Rent */}
          {(drop.isEnded || drop.isCanceled) && (
            <button onClick={() => setShowConfirm(true)} disabled={closing}
              className={clsx(
                "text-xs font-body px-3 py-1.5 rounded-lg border transition-colors ml-auto",
                closing ? "text-muted border-border cursor-not-allowed"
                  : "text-muted border-border hover:text-text hover:border-accent/30"
              )}>
              {closing ? "Closing…" : "Close & Reclaim Rent"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DropDashboard() {
  const { publicKey, connected } = useWallet();
  const { toast } = useToast();

  const [drops, setDrops] = useState<DropInfo[]>([]);
  const [slugs, setSlugs] = useState<Record<string, string>>({}); // address → slug
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [token, setToken] = useState<TokenFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    if (!publicKey) return;
    setLoading(true);
    fetchDropsByCreator(publicKey)
      .then(async (fetched) => {
        setDrops(fetched);
        if (fetched.length === 0) return;
        // Use auth cache from SIWS sign on wallet connect
        const walletAddress = publicKey.toBase58();
        const auth = getCachedAuth(walletAddress);
        if (!auth) return;
        try {
          const res = await fetch("/api/mydrop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              signature: auth.signature,
              nonce: auth.nonce,
              issuedAt: auth.issuedAt,
              dropAddresses: fetched.map(d => d.address),
            }),
          });
          if (res.ok) {
            const { slugs: fetched_slugs } = await res.json();
            setSlugs(fetched_slugs ?? {});
          } else if (res.status === 403) {
            const data = await res.json().catch(() => ({}));
            if (data.error === "Signature expired") {
              notifyAuthExpired(walletAddress);
              toast("Session expired. Please sign the message again.", "error");
              // Retry load after user has time to sign (popup will be triggered by auth:expired)
              setTimeout(() => load(), 4000);
            }
          }
        } catch { /* fetch failed — slugs remain empty */ }
      })
      .catch(err => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [publicKey, toast]);

  useEffect(() => {
    if (!publicKey) { setDrops([]); setSlugs({}); return; }
    load();
  }, [publicKey, load]);

  const filtered = useMemo(() => {
    let list = [...drops];
    if (status === "active") list = list.filter(d => d.isActive);
    if (status === "ended") list = list.filter(d => d.isEnded);
    if (status === "canceled") list = list.filter(d => d.isCanceled);
    if (token === "sol") list = list.filter(d => d.isNativeSol);
    if (token === "spl") list = list.filter(d => !d.isNativeSol);
    if (sort === "most_claimed") list = list.sort((a, b) => b.currentClaims - a.currentClaims);
    if (sort === "oldest") list = list.reverse();
    return list;
  }, [drops, status, token, sort]);

  useEffect(() => setPage(1), [status, token, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeCount = drops.filter(d => d.isActive).length;
  const totalClaims = drops.reduce((s, d) => s + d.currentClaims, 0);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <p className="text-muted font-body text-sm">Connect your wallet to see your drops</p>
        <DynamicWalletButton style={{
          background: "#F97316", borderRadius: "10px",
          fontSize: "13px", fontFamily: "'DM Sans'", height: "40px", padding: "0 20px",
        }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Drops", value: drops.length },
          { label: "Active", value: activeCount },
          { label: "Total Claims", value: totalClaims },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-3 sm:p-4 text-center">
            <p className="font-display text-xl sm:text-2xl font-bold text-text">{s.value}</p>
            <p className="font-body text-xs text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap gap-2">
        {/* Status */}
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-body">
          {(["all", "active", "ended", "canceled"] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={clsx("px-3 py-2 capitalize transition-colors",
                status === s ? "bg-accent text-bg font-bold" : "text-muted hover:text-text"
              )}>
              {s}
            </button>
          ))}
        </div>

        {/* Token */}
        <div className="flex rounded-xl border border-border overflow-hidden text-xs font-body">
          {([["all", "All"], ["sol", "SOL"], ["spl", "SPL"]] as [TokenFilter, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setToken(v)}
              className={clsx("px-3 py-2 transition-colors",
                token === v ? "bg-accent text-bg font-bold" : "text-muted hover:text-text"
              )}>
              {l}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value as SortOption)}
          className="ml-auto bg-surface border border-border rounded-xl px-3 py-2 text-xs font-body text-muted focus:outline-none focus:border-accent/50 cursor-pointer">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most_claimed">Most Claimed</option>
        </select>
      </div>

      {/* List */}
      {paginated.length === 0 ? (
        drops.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-4xl">🎁</p>
            <p className="text-text font-display font-bold text-lg">No drops yet</p>
            <p className="text-muted font-body text-sm">Create your first drop and share it with your community</p>
            <Link href="/create"
              className="inline-block mt-2 px-6 py-3 rounded-xl bg-accent text-bg font-display font-bold text-sm hover:bg-accent/90 transition-all">
              Create Drop →
            </Link>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted font-body text-sm">No drops match your filters</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {paginated.map(drop => (
            <DropCard key={drop.address} drop={drop} claimSlug={slugs[drop.address] ?? null} onMutated={load} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-text hover:border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={clsx("w-8 h-8 rounded-lg text-xs font-mono transition-colors",
                  page === p ? "bg-accent text-bg font-bold"
                    : "text-muted hover:text-text border border-border hover:border-accent/30"
                )}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-text hover:border-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
