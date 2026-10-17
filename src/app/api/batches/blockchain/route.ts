import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ======================================================
// SAVE BLOCKCHAIN TRANSACTION DETAILS
// ======================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("BLOCKCHAIN API RECEIVED BODY:", body);

    const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";

    const transactionHash =
      typeof body.transactionHash === "string"
        ? body.transactionHash.trim()
        : "";

    const rawBlockNumber = body.blockNumber;

    console.log("BLOCKCHAIN API VALUES:", {
      batchId,
      transactionHash,
      rawBlockNumber,
      blockNumberType: typeof rawBlockNumber,
    });

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!batchId) {
      return NextResponse.json(
        {
          error: "Batch ID is required.",
        },
        { status: 400 },
      );
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      console.error("INVALID TRANSACTION HASH:", transactionHash);

      return NextResponse.json(
        {
          error: "A valid transaction hash is required.",
        },
        { status: 400 },
      );
    }

    let blockNumber: number;

    try {
      blockNumber = Number(rawBlockNumber);
    } catch {
      return NextResponse.json(
        {
          error: "Block number could not be converted to a number.",
        },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(blockNumber) || blockNumber <= 0) {
      console.error("INVALID BLOCK NUMBER:", rawBlockNumber);

      return NextResponse.json(
        {
          error: "A valid block number is required.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // CHECK THAT THE BATCH EXISTS
    // --------------------------------------------------

    console.log("CHECKING BATCH BEFORE BLOCKCHAIN UPDATE:", batchId);

    const { data: existingBatch, error: findError } = await supabaseServer
      .from("batches")
      .select("id, transaction_hash, block_number")
      .eq("id", batchId)
      .maybeSingle();

    if (findError) {
      console.error("FAILED TO FIND BATCH:", findError);

      return NextResponse.json(
        {
          error: "Could not find batch in Supabase.",
          details: findError.message,
        },
        { status: 500 },
      );
    }

    if (!existingBatch) {
      console.error("BATCH DOES NOT EXIST:", batchId);

      return NextResponse.json(
        {
          error: `Batch ${batchId} was not found in Supabase.`,
        },
        { status: 404 },
      );
    }

    console.log("BATCH BEFORE BLOCKCHAIN UPDATE:", existingBatch);

    // --------------------------------------------------
    // UPDATE BLOCKCHAIN METADATA
    // --------------------------------------------------

    console.log("UPDATING BLOCKCHAIN METADATA:", {
      id: batchId,
      transaction_hash: transactionHash,
      block_number: blockNumber,
    });

    const { data: updatedBatch, error: updateError } = await supabaseServer
      .from("batches")
      .update({
        transaction_hash: transactionHash,
        block_number: blockNumber,
      })
      .eq("id", batchId)
      .select("id, transaction_hash, block_number")
      .maybeSingle();

    if (updateError) {
      console.error("BLOCKCHAIN DETAILS UPDATE FAILED:", updateError);

      return NextResponse.json(
        {
          error: "Could not save blockchain details to Supabase.",
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint,
        },
        { status: 500 },
      );
    }

    if (!updatedBatch) {
      console.error("UPDATE RETURNED NO BATCH:", batchId);

      return NextResponse.json(
        {
          error: "Supabase update completed but no batch was returned.",
        },
        { status: 500 },
      );
    }

    console.log("BLOCKCHAIN METADATA SAVED:", updatedBatch);

    // --------------------------------------------------
    // VERIFY BY READING DATABASE AGAIN
    // --------------------------------------------------

    const { data: verifiedBatch, error: verifyError } = await supabaseServer
      .from("batches")
      .select("id, transaction_hash, block_number")
      .eq("id", batchId)
      .single();

    if (verifyError) {
      console.error("BLOCKCHAIN METADATA VERIFY FAILED:", verifyError);

      return NextResponse.json(
        {
          error: "Metadata was updated, but verification failed.",
          details: verifyError.message,
        },
        { status: 500 },
      );
    }

    console.log("BLOCKCHAIN METADATA VERIFIED:", verifiedBatch);

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      message: "Blockchain metadata saved successfully.",
      batch: verifiedBatch,
    });
  } catch (error) {
    console.error("BLOCKCHAIN API UNEXPECTED ERROR:", error);

    return NextResponse.json(
      {
        error: "Invalid request or server error.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
