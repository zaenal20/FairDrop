const FAIRSCALE_API_BASE = "https://api2.fairscale.xyz";

export interface FairScaleResult {
  score: number;
  address: string;
}

export async function getFairScaleScore(
  walletAddress: string
): Promise<FairScaleResult> {
  const apiKey = process.env.FAIRSCALE_API_KEY;
  if (!apiKey) throw new Error("FAIRSCALE_API_KEY is not set");

  const url = `${FAIRSCALE_API_BASE}/fairScore?wallet=${walletAddress}`;
  const res = await fetch(url, {
    headers: {
      "fairkey": apiKey,
      "accept": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) return { score: 0, address: walletAddress };
    throw new Error(`FairScale API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    score: data.fair_score ?? 0,
    address: walletAddress,
  };
}