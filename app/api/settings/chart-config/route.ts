import { type NextRequest } from "next/server";
import {
  getChartConfig,
  setChartConfig,
  type ChartConfig,
} from "@/lib/settings/chart-config";

export async function GET() {
  const cfg = await getChartConfig();
  return Response.json(cfg);
}

export async function PUT(request: NextRequest) {
  let body: Partial<ChartConfig>;
  try {
    body = (await request.json()) as Partial<ChartConfig>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Basic shape validation — the merge step will fill in missing fields.
  if (body.countries && !Array.isArray(body.countries)) {
    return Response.json({ error: "countries must be an array" }, { status: 400 });
  }
  if (body.chartTypes && !Array.isArray(body.chartTypes)) {
    return Response.json({ error: "chartTypes must be an array" }, { status: 400 });
  }
  if (body.topN !== undefined && (body.topN < 1 || body.topN > 500)) {
    return Response.json({ error: "topN must be 1..500" }, { status: 400 });
  }

  const saved = await setChartConfig(body);
  return Response.json(saved);
}
