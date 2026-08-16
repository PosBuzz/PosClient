import { NextRequest, NextResponse } from "next/server";
import { LeadPayload, submitLead } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy for the contact form and demo modal. Keeping the call on
 * the server means the browser never talks to the backend directly, so the API
 * origin stays private and no CORS allowance is needed for the marketing site.
 */
export async function POST(request: NextRequest) {
  let body: Partial<LeadPayload>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  if (!body?.name || !body?.email || !body?.type) {
    return NextResponse.json(
      { message: "Name, email and type are required" },
      { status: 400 },
    );
  }

  try {
    await submitLead({
      type: body.type,
      name: body.name,
      email: body.email,
      phone: body.phone,
      business_name: body.business_name,
      industry: body.industry,
      locations: body.locations,
      message: body.message,
      source_page: body.source_page,
      company_website: body.company_website,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[portfolio] lead submission failed:", error);
    return NextResponse.json(
      { message: "We could not submit your request. Please try again." },
      { status: 502 },
    );
  }
}
