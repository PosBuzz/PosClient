import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Publish hook. The backend calls this whenever a super admin changes portfolio
 * content, so edits go live immediately instead of waiting out the ISR window.
 *
 * Every page reads the CMS through a single fetch tagged "portfolio-content"
 * (see lib/api.ts), so invalidating that one tag refreshes the whole site.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  // Without a configured secret the hook stays closed rather than becoming an
  // unauthenticated cache-buster.
  if (!secret) {
    return NextResponse.json(
      { message: "Revalidation is not configured" },
      { status: 503 },
    );
  }

  const provided =
    request.headers.get("x-revalidate-secret") ||
    request.nextUrl.searchParams.get("secret");

  if (provided !== secret) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  revalidateTag("portfolio-content");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
