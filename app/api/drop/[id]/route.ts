import { NextRequest, NextResponse } from "next/server";
import { fetchDrop } from "@/lib/program";

// GET /api/drop/[id]
// Returns parsed drop account data. Used by ClaimDropCard to render drop info.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const drop = await fetchDrop(id);
    if (!drop) {
      return NextResponse.json({ error: "Drop not found" }, { status: 404 });
    }

    return NextResponse.json(drop);
  } catch (err) {
    console.error("[api/drop/id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
