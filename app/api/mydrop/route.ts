import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { getSlugsByCreator } from "@/lib/db";
import { buildSignInMessage } from "@/lib/siws";

const MAX_MESSAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      signature,
      nonce,
      issuedAt,
      dropAddresses
    } = body as {
      walletAddress: string;
      signature: string;
      nonce: string;
      issuedAt?: string;
      dropAddresses: string[];
    };

    if (!walletAddress || !signature || !nonce || !Array.isArray(dropAddresses)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    if (issuedAt) {
      const messageTime = new Date(issuedAt).getTime();
      const now = Date.now();

      if (isNaN(messageTime)) {
        return NextResponse.json(
          { error: "Invalid issuedAt format" },
          { status: 400 }
        );
      }

      if (now - messageTime > MAX_MESSAGE_AGE_MS) {
        return NextResponse.json(
          { error: "Signature expired" },
          { status: 403 }
        );
      }

      if (messageTime > now + 60000) {
        return NextResponse.json(
          { error: "Invalid timestamp" },
          { status: 400 }
        );
      }
    }

    const domain = new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).host;

    const message = buildSignInMessage(domain, walletAddress, nonce, issuedAt);

    let signatureBytes: Uint8Array;
    try {
      const base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
      signatureBytes = Buffer.from(padded, "base64");
    } catch {
      return NextResponse.json(
        { error: "Invalid signature format" },
        { status: 400 }
      );
    }

    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      signatureBytes,
      pubkey.toBytes()
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403 }
      );
    }

    const slugs = await getSlugsByCreator(dropAddresses, walletAddress);

    return NextResponse.json({
      success: true,
      slugs,
    });

  } catch (err) {
    console.error("[my-slugs]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}