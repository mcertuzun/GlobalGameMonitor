import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appId = Number(id);

  if (isNaN(appId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  return Response.json(rows[0]);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appId = Number(id);

  if (isNaN(appId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  // Check app exists
  const existing = await db
    .select()
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1);

  if (existing.length === 0) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, developer, category, isOwnGame } = body;

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (name !== undefined) updates.name = name;
  if (developer !== undefined) updates.developer = developer;
  if (category !== undefined) updates.category = category;
  if (isOwnGame !== undefined) updates.isOwnGame = isOwnGame;

  await db.update(apps).set(updates).where(eq(apps.id, appId));

  const [updated] = await db
    .select()
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1);

  return Response.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appId = Number(id);

  if (isNaN(appId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1);

  if (existing.length === 0) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  await db.delete(apps).where(eq(apps.id, appId));

  return Response.json({ success: true });
}
