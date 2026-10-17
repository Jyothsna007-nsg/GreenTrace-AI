import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ======================================================
// GET ALL BATCHES
// ======================================================

export async function GET() {
  try {
    // --------------------------------------------------
    // FETCH BATCHES
    // --------------------------------------------------

    const { data: batches, error: batchError } = await supabaseServer
      .from("batches")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (batchError) {
      console.error("Batch fetch failed:", batchError.message);

      return NextResponse.json(
        {
          error: "Could not fetch batches.",
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // FETCH SUPPLY-CHAIN EVENTS
    // --------------------------------------------------

    const { data: events, error: eventError } = await supabaseServer
      .from("supply_chain_events")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    if (eventError) {
      console.error("Event fetch failed:", eventError.message);

      return NextResponse.json(
        {
          error: "Could not fetch supply-chain events.",
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // MAP DATABASE FIELDS TO FRONTEND Batch TYPE
    // --------------------------------------------------

    const result = (batches ?? []).map((batch) => ({
      id: batch.id,

      product: batch.product,

      category: batch.category,

      quantity: String(batch.quantity),

      unit: batch.unit,

      farmName: batch.farm_name,

      location: batch.location,

      harvestDate: batch.harvest_date,

      certification: batch.certification_ref ?? "",

      farmerName: batch.farmer_name,

      createdAt: batch.created_at,

      // ----------------------------------------------
      // BLOCKCHAIN METADATA
      // ----------------------------------------------

      transactionHash: batch.transaction_hash ?? null,

      blockNumber:
        batch.block_number === null || batch.block_number === undefined
          ? null
          : Number(batch.block_number),

      // ----------------------------------------------
      // SUPPLY-CHAIN EVENTS
      // ----------------------------------------------

      events: (events ?? [])
        .filter((event) => event.batch_id === batch.id)
        .map((event) => ({
          type: event.event_type,

          date: event.event_date,

          location: event.location,

          notes: event.notes ?? "",

          actor: event.actor_name,

          quantity: event.quantity ?? "",
        })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Batch GET API error:", error);

    return NextResponse.json(
      {
        error: "Unexpected error while fetching batches.",
      },
      { status: 500 },
    );
  }
}

// ======================================================
// CREATE NEW BATCH
// ======================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // --------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------

    const required = [
      "id",
      "product",
      "category",
      "quantity",
      "unit",
      "farmName",
      "location",
      "harvestDate",
      "farmerName",
    ];

    for (const field of required) {
      if (
        body[field] === undefined ||
        body[field] === null ||
        String(body[field]).trim() === ""
      ) {
        return NextResponse.json(
          {
            error: `Missing required field: ${field}`,
          },
          { status: 400 },
        );
      }
    }

    // --------------------------------------------------
    // QUANTITY VALIDATION
    // --------------------------------------------------

    const quantity = Number(body.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        {
          error: "Quantity must be a positive number.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------

    if (
      typeof body.harvestDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.harvestDate)
    ) {
      return NextResponse.json(
        {
          error: "Harvest date must use YYYY-MM-DD format.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // BUILD DATABASE BATCH
    // --------------------------------------------------

    const batch = {
      id: String(body.id).trim(),

      product: String(body.product).trim(),

      category: String(body.category).trim(),

      quantity,

      unit: String(body.unit).trim(),

      farm_name: String(body.farmName).trim(),

      location: String(body.location).trim(),

      harvest_date: body.harvestDate,

      certification_ref: String(body.certification || "").trim() || null,

      farmer_name: String(body.farmerName).trim(),
    };

    // --------------------------------------------------
    // INSERT BATCH
    // --------------------------------------------------

    const { error: batchError } = await supabaseServer
      .from("batches")
      .insert(batch);

    if (batchError) {
      console.error("Batch insert failed:", batchError.message);

      return NextResponse.json(
        {
          error:
            "Could not save the batch. Check the database schema and batch ID.",
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // INSERT INITIAL HARVEST EVENT
    // --------------------------------------------------

    const { error: eventError } = await supabaseServer
      .from("supply_chain_events")
      .insert({
        batch_id: batch.id,

        event_type: "Harvested",

        event_date: body.harvestDate,

        location: batch.location,

        notes: "Batch registered by farmer",

        actor_name: batch.farmer_name,

        quantity: `${quantity} ${batch.unit}`,
      });

    // --------------------------------------------------
    // ROLLBACK IF INITIAL EVENT FAILS
    // --------------------------------------------------

    if (eventError) {
      const { error: rollbackError } = await supabaseServer
        .from("batches")
        .delete()
        .eq("id", batch.id);

      console.error("Initial event insert failed:", eventError.message);

      if (rollbackError) {
        console.error("Batch cleanup failed:", rollbackError.message);
      }

      return NextResponse.json(
        {
          error: "Could not save the initial harvest event.",
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
        batchId: batch.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Batch API error:", error);

    return NextResponse.json(
      {
        error: "Invalid request or server error.",
      },
      { status: 400 },
    );
  }
}
