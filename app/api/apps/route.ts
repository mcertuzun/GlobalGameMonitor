import { type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";
import { desc, and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(apps)
    .orderBy(desc(apps.updatedAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ page, limit, data: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { store, storeId, name, developer, category, isOwnGame } = body;

  // Validate required fields
  if (!store || !storeId || !name) {
    return Response.json(
      { error: "Missing required fields: store, storeId, name" },
      { status: 400 }
    );
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(apps)
    .where(and(eq(apps.store, store), eq(apps.storeId, storeId)))
    .limit(1);

  if (existing.length > 0) {
    return Response.json(
      { error: "App with this store and storeId already exists" },
      { status: 409 }
    );
  }

  const [inserted] = await db
    .insert(apps)
    .values({
      store,
      storeId,
      name,
      developer: developer ?? null,
      category: category ?? null,
      isOwnGame: isOwnGame ?? false,
    })
    .returning();

  return Response.json(inserted, { status: 201 });
}
