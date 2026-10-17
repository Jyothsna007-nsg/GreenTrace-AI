import { Suspense } from "react";
import TrackPage from "./TrackPage";
export default function Page(){return <Suspense fallback={<main className="track-container"><p>Loading scanner…</p></main>}><TrackPage /></Suspense>}
