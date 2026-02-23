import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const slugKey = (slug: string) => `drop:slug:${slug}`;
const metaKey = (dropAddress: string) => `drop:meta:${dropAddress}`;

interface DropMeta {
  slug: string;
  creator: string; // wallet address — untuk verifikasi ownership
}

export function generateSlug(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url").slice(0, 12);
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveSlug(
  slug: string,
  dropAddress: string,
  creator: string,
): Promise<void> {
  const meta: DropMeta = { slug, creator };
  await redis.pipeline()
    .set(slugKey(slug), dropAddress)
    .set(metaKey(dropAddress), JSON.stringify(meta))
    .exec();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function resolveSlug(slug: string): Promise<string | null> {
  return redis.get<string>(slugKey(slug));
}

export async function verifySlug(slug: string, dropAddress: string): Promise<boolean> {
  const stored = await resolveSlug(slug);
  return stored === dropAddress;
}

export async function getSlugsByCreator(
  dropAddresses: string[],
  creator: string,
): Promise<Record<string, string>> {
  if (dropAddresses.length === 0) return {};

  const keys = dropAddresses.map(metaKey);
  const values = await redis.mget<string[]>(...keys);

  const result: Record<string, string> = {};
  for (let i = 0; i < dropAddresses.length; i++) {
    const raw = values[i];
    if (!raw) continue;
    try {
      const meta: DropMeta = typeof raw === "string" ? JSON.parse(raw) : raw;
      // Hanya return kalau creator cocok
      if (meta.creator === creator) {
        result[dropAddresses[i]] = meta.slug;
      }
    } catch { /* skip malformed entry */ }
  }
  return result;
}
