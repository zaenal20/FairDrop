import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { generateSlug, saveSlug, resolveSlug } from "@/lib/db";
import { fetchDrop } from "@/lib/program";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dropAddress, creator } = body as { dropAddress: string; creator: string };

    if (!dropAddress || !creator) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try { new PublicKey(dropAddress); new PublicKey(creator); }
    catch { return NextResponse.json({ error: "Invalid address" }, { status: 400 }); }

    // Verify drop exists on-chain and creator matches
    const drop = await fetchDrop(dropAddress);
    if (!drop) {
      return NextResponse.json({ error: "Drop not found on-chain" }, { status: 404 });
    }
    if (drop.creator !== creator) {
      return NextResponse.json({ error: "Not the creator of this drop" }, { status: 403 });
    }

    // Generate unique slug
    let slug = generateSlug();
    let attempts = 0;
    while (await resolveSlug(slug) !== null) {
      slug = generateSlug();
      if (++attempts > 5) {
        return NextResponse.json({ error: "Failed to generate unique slug" }, { status: 500 });
      }
    }

    await saveSlug(slug, dropAddress, creator);
    return NextResponse.json({ slug });
  } catch (err) {
    console.error("[create-slug]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
