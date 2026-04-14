import { getApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

async function testApiKey(
  keyId: string,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  switch (keyId) {
    case "YOUTUBE_API_KEY": {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&q=test&maxResults=1&key=${apiKey}`
      );
      if (res.ok) return { ok: true, message: "YouTube API connected" };
      const err = await res.json();
      return { ok: false, message: err.error?.message || `HTTP ${res.status}` };
    }
    case "STEAM_API_KEY": {
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=76561197960435530`
      );
      if (res.ok) return { ok: true, message: "Steam API connected" };
      return { ok: false, message: `HTTP ${res.status}` };
    }
    case "TWITCH_CLIENT_ID": {
      const secret = await getApiKey("TWITCH_CLIENT_SECRET");
      if (!secret)
        return { ok: false, message: "Twitch Client Secret is also required" };
      const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${apiKey}&client_secret=${secret}&grant_type=client_credentials`,
        { method: "POST" }
      );
      if (res.ok) return { ok: true, message: "Twitch OAuth connected" };
      const err = await res.json();
      return { ok: false, message: err.message || `HTTP ${res.status}` };
    }
    case "TWITCH_CLIENT_SECRET": {
      const clientId = await getApiKey("TWITCH_CLIENT_ID");
      if (!clientId)
        return { ok: false, message: "Twitch Client ID is also required" };
      const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${apiKey}&grant_type=client_credentials`,
        { method: "POST" }
      );
      if (res.ok) return { ok: true, message: "Twitch OAuth connected" };
      const err = await res.json();
      return { ok: false, message: err.message || `HTTP ${res.status}` };
    }
    case "REDDIT_CLIENT_ID": {
      const secret = await getApiKey("REDDIT_CLIENT_SECRET");
      if (!secret)
        return {
          ok: false,
          message: "Reddit Client Secret is also required",
        };
      const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");
      const res = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (res.ok) return { ok: true, message: "Reddit OAuth connected" };
      return { ok: false, message: `HTTP ${res.status}` };
    }
    case "REDDIT_CLIENT_SECRET": {
      const clientId = await getApiKey("REDDIT_CLIENT_ID");
      if (!clientId)
        return { ok: false, message: "Reddit Client ID is also required" };
      const auth = Buffer.from(`${clientId}:${apiKey}`).toString("base64");
      const res = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (res.ok) return { ok: true, message: "Reddit OAuth connected" };
      return { ok: false, message: `HTTP ${res.status}` };
    }
    case "RAWG_API_KEY": {
      const res = await fetch(
        `https://api.rawg.io/api/games?key=${apiKey}&page_size=1`
      );
      if (res.ok) return { ok: true, message: "RAWG API connected" };
      return { ok: false, message: `HTTP ${res.status}` };
    }
    case "META_AD_LIBRARY_TOKEN": {
      // debug_token verifies the token shape without burning ads_archive quota.
      const url = new URL("https://graph.facebook.com/v20.0/debug_token");
      url.searchParams.set("input_token", apiKey);
      url.searchParams.set("access_token", apiKey);
      const res = await fetch(url.toString());
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const json = (await res.json()) as {
        data?: { is_valid?: boolean; type?: string; scopes?: string[] };
        error?: { message?: string };
      };
      if (json.error) {
        return { ok: false, message: json.error.message ?? "Meta error" };
      }
      if (!json.data?.is_valid) {
        return { ok: false, message: "Token reported invalid by Meta" };
      }
      const scopes = json.data.scopes ?? [];
      if (!scopes.includes("ads_read")) {
        return {
          ok: false,
          message: `Token missing 'ads_read' scope (has: ${scopes.join(", ") || "none"})`,
        };
      }
      return {
        ok: true,
        message: `Meta ${json.data.type ?? "token"} valid with ads_read`,
      };
    }
    default:
      return { ok: false, message: "Unknown key type" };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { keyId } = body;

    if (!keyId || typeof keyId !== "string") {
      return Response.json({ ok: false, message: "keyId is required" }, { status: 400 });
    }

    const apiKey = await getApiKey(keyId);
    if (!apiKey) {
      return Response.json({ ok: false, message: "Key not set" });
    }

    const result = await testApiKey(keyId, apiKey);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { ok: false, message: `Connection error: ${message}` },
      { status: 500 }
    );
  }
}
