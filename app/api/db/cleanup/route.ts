import { cleanupOldData, vacuumDb } from "@/lib/db/cleanup";
import { SCRAPER_LIMITS } from "@/lib/config";

export async function POST(request: Request) {
  let retentionDays = SCRAPER_LIMITS.retentionDays;

  try {
    const body = await request.json();
    if (body?.retentionDays && typeof body.retentionDays === "number") {
      retentionDays = body.retentionDays;
    }
  } catch {
    // No body or invalid JSON — use default
  }

  const results = await cleanupOldData(retentionDays);
  await vacuumDb();

  return Response.json({
    status: "success",
    retentionDays,
    ...results,
  });
}
