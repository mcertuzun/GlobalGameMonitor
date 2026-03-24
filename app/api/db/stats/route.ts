import { getDbStats } from "@/lib/db/cleanup";

export async function GET() {
  const stats = await getDbStats();
  return Response.json(stats);
}
