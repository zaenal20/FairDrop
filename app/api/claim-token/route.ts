import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getFairScaleScore } from "@/lib/fairscale";
import { signClaimToken } from "@/lib/signer";
import { fetchDrop } from "@/lib/program";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifySlug } from "@/lib/db";

// Rate limit config
const RATE_LIMIT_PER_WALLET = { limit: 10,  windowMs: 60 * 1000 }; // 10 req/min per wallet
const RATE_LIMIT_PER_IP     = { limit: 30,  windowMs: 60 * 1000 }; // 30 req/min per IP
const RATE_LIMIT_GLOBAL     = { limit: 500, windowMs: 60 * 1000 }; // 500 req/min global

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Global rate limit
    const globalLimit = checkRateLimit("global", RATE_LIMIT_GLOBAL);
    if (!globalLimit.allowed) {
      return NextResponse.json(
        { error: "Server is busy, please try again later" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((globalLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    // 2. Per-IP rate limit
    const ipLimit = checkRateLimit(`ip:${ip}`, RATE_LIMIT_PER_IP);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests from your IP, please wait a moment" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((ipLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Validate input
    const body = await req.json();
    const { dropAddress, claimer, slug } = body as {
      dropAddress: string;
      claimer:     string;
      slug:        string;
    };

    if (!dropAddress || !claimer || !slug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 3. Verify slug matches drop_address in DB
    // Prevents direct API calls from anyone who knows the drop_address
    const slugValid = await verifySlug(slug, dropAddress);
    if (!slugValid) {
      return NextResponse.json({ error: "Invalid claim link" }, { status: 403 });
    }

    let claimerPubkey: PublicKey;
    try { claimerPubkey = new PublicKey(claimer); }
    catch { return NextResponse.json({ error: "Invalid claimer address" }, { status: 400 }); }

    // 4. Per-wallet rate limit
    const walletLimit = checkRateLimit(`wallet:${claimer}`, RATE_LIMIT_PER_WALLET);
    if (!walletLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests from this wallet, please wait a moment" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((walletLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Fetch drop
    const drop = await fetchDrop(dropAddress);
    if (!drop)          return NextResponse.json({ error: "Drop not found" }, { status: 404 });
    if (!drop.isActive) return NextResponse.json({ error: "Drop is no longer active" }, { status: 400 });

    // FairScale score
    let fairscaleScore = 0;
    if (drop.minFairscaleScore > 0) {
      const result = await getFairScaleScore(claimer);
      fairscaleScore = result.score;
      if (fairscaleScore < drop.minFairscaleScore) {
        return NextResponse.json({
          error:    "FairScale score too low",
          required: drop.minFairscaleScore,
          actual:   fairscaleScore,
        }, { status: 403 });
      }
    } else {
      try { fairscaleScore = (await getFairScaleScore(claimer)).score; } catch { fairscaleScore = 0; }
    }

    // Sign claim token
    const claimToken = signClaimToken(
      new Uint8Array(drop.dropId),
      claimerPubkey.toBytes(),
      fairscaleScore,
    );

    return NextResponse.json({ claimToken });
  } catch (err) {
    console.error("[claim-token]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
