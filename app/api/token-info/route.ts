import { NextRequest, NextResponse } from "next/server";

const CLUSTER_MAP: Record<string, number> = {
  "mainnet-beta": 1,
  "testnet": 3,
  "devnet": 2,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint");
  const network = searchParams.get("network") ?? "devnet";

  if (!mint) {
    return NextResponse.json({ error: "mint is required" }, { status: 400 });
  }

  const cluster = CLUSTER_MAP[network] ?? 2;

  try {
    const res = await fetch("https://explorer.solana.com/api/token-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: mint, cluster }),
      // 5 second timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const data = await res.json();
    const content = data?.content;

    if (!content) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: content.name ?? null,
      symbol: content.symbol ?? null,
      decimals: content.decimals ?? null,
      logoURI: content.logoURI ?? null,
      verified: content.verified ?? false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch token info" },
      { status: 500 },
    );
  }
}
