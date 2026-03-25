import { getAllApiKeys, setApiKey, deleteApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keys = await getAllApiKeys();
    return Response.json(keys);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { keyId, value } = body;

    if (!keyId || typeof keyId !== "string") {
      return Response.json({ error: "keyId is required" }, { status: 400 });
    }
    if (!value || typeof value !== "string") {
      return Response.json(
        { error: "value is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    await setApiKey(keyId, value.trim());

    const keys = await getAllApiKeys();
    return Response.json(keys);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { keyId } = body;

    if (!keyId || typeof keyId !== "string") {
      return Response.json({ error: "keyId is required" }, { status: 400 });
    }

    await deleteApiKey(keyId);

    const keys = await getAllApiKeys();
    return Response.json(keys);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
