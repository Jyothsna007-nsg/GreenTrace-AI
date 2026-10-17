# GreenTrace AI / FarmTrace UI starter

This starter recreates the uploaded FarmTrace screenshot layout: horizontal top navigation, cream canvas, forest-green hero/buttons, serif headings, role cards, four dashboard stats, two-column forms/lists, and centered QR tracking.

## Run
1. Back up your current project.
2. Copy `src/app`, `src/components`, and `src/lib` from this starter into your project, replacing files with the same paths if you intend to use this UI.
3. Make sure there is only one Next.js App Router directory. This starter uses `src/app`; if a root-level `app/` exists and is the old default page, move/delete that duplicate after checking it.
4. From the project root run `npm install` and `npm run dev`.
5. Open the local URL printed in the terminal.

If you want to run it as a fresh project, copy all files from this folder into a new folder, then run `npm install` and `npm run dev`.

## Current behavior
- Farmer can register a batch in browser localStorage.
- Manufacturer, distributor, and retailer can append demo events to batches.
- Farmer dashboard renders a QR code for each batch.
- Consumer can view products after a retail event.
- `/track?id=BATCH_ID` displays the locally stored traceability timeline.

## Important
This is the first UI/MVP step, not the final blockchain system. Browser localStorage is not shared between browsers/users and is not a secure database. On-chain count intentionally remains 0. Do not describe local records as blockchain verified. Next integration steps: Supabase/Auth/RLS, real EVM testnet contract and wallet signing, certification evidence verification, camera QR decoding, and Telugu speech-to-form assistant.
