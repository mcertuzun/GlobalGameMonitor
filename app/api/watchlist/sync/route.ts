import { type NextRequest } from "next/server";
import { syncWatchlist } from "@/lib/watchlist/sync";

export async function POST(request: NextRequest) {
  let body: { topFreeRank?: number; topGrossingRank?: number; retentionDays?: number } = {};
  try {
    body = await request.json();
  } catch {
    // No body = use defaults
  }

  const report = await syncWatchlist(body);
  return Response.json(report);
}

export async function GET() {
  const report = await syncWatchlist();
  return Response.json(report);
}
