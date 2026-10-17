import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ======================================================
// CREATE SUPPLY-CHAIN EVENT
// ======================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // --------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------

    const required = ["batchId", "event", "date", "location", "actor"];

    for (const field of required) {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return NextResponse.json(
          {
            error: `Missing required field: ${field}`,
          },
          { status: 400 },
        );
      }
    }

    // --------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------

    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        {
          error: "Event date must use YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // ALLOWED SUPPLY-CHAIN EVENTS
    // --------------------------------------------------

    const allowedEvents = [
      "Processed",
      "Packaged",
      "Quality checked",
      "Dispatched",
      "In transit",
      "Delivered to retailer",
      "Received at store",
      "Listed for sale",
    ];

    if (!allowedEvents.includes(body.event)) {
      return NextResponse.json(
        {
          error: "Unsupported supply-chain event.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // VERIFY THAT THE BATCH EXISTS
    // --------------------------------------------------

    const { data: batch, error: batchError } = await supabaseServer
      .from("batches")
      .select("id")
      .eq("id", body.batchId.trim())
      .maybeSingle();

    if (batchError) {
      console.error("Batch lookup failed:", batchError.message);

      return NextResponse.json(
        {
          error: "Could not verify the selected batch.",
        },
        { status: 500 },
      );
    }

    if (!batch) {
      return NextResponse.json(
        {
          error: "Batch not found in Supabase. Register it first.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // INSERT SUPPLY-CHAIN EVENT
    // --------------------------------------------------

    const { data, error } = await supabaseServer
      .from("supply_chain_events")
      .insert({
        batch_id: body.batchId.trim(),

        event_type: body.event,

        event_date: body.date,

        location: body.location.trim(),

        notes: typeof body.notes === "string" ? body.notes.trim() : "",

        actor_name: body.actor.trim(),

        quantity:
          typeof body.quantity === "string" && body.quantity.trim()
            ? body.quantity.trim()
            : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Event insert failed:", error.message);

      return NextResponse.json(
        {
          error: "Could not save the supply-chain event.",
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        eventId: data.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Event API error:", error);

    return NextResponse.json(
      {
        error: "Invalid request or server error.",
      },
      { status: 400 },
    );
  }
}
