import { getApiKey } from "@/lib/api-keys";

const META_GRAPH_VERSION = "v20.0";

/**
 * Cheap health-check for the configured Meta Ad Library token. Hits debug_token
 * for metadata (expiration, scopes, app id) and a 1-result ads_archive query
 * for rate-limit header visibility. Doesn't consume meaningful quota.
 */

interface DebugTokenResponse {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    data_access_expires_at?: number; // unix seconds
    expires_at?: number;
    is_valid?: boolean;
    issued_at?: number;
    scopes?: string[];
    user_id?: string;
    error?: { message?: string; code?: number };
  };
  error?: { message?: string };
}

function parseAppUsageHeader(raw: string | null): {
  call_count?: number;
  total_cputime?: number;
  total_time?: number;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  const token = await getApiKey("META_AD_LIBRARY_TOKEN");
  if (!token) {
    return Response.json(
      {
        ok: false,
        stage: "missing",
        message:
          "META_AD_LIBRARY_TOKEN is not configured — add it in Settings or set the env var.",
      },
      { status: 400 }
    );
  }

  // Step 1: debug_token — token metadata, doesn't require a second app token.
  // Meta recommends calling with the token debugging itself (input_token=token,
  // access_token=token), which works for user and system user tokens.
  let debug: DebugTokenResponse["data"] | null = null;
  let debugError: string | null = null;
  try {
    const debugUrl = new URL(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token`
    );
    debugUrl.searchParams.set("input_token", token);
    debugUrl.searchParams.set("access_token", token);
    const resp = await fetch(debugUrl.toString(), {
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await resp.json()) as DebugTokenResponse;
    if (body.error) debugError = body.error.message ?? "debug_token error";
    else debug = body.data ?? null;
  } catch (err) {
    debugError = err instanceof Error ? err.message : String(err);
  }

  // Step 2: minimal ads_archive call — confirm the token can actually read
  // the archive, and capture rate-limit headers.
  let archiveOk = false;
  let archiveError: string | null = null;
  let appUsage: ReturnType<typeof parseAppUsageHeader> = null;
  let buUsage: string | null = null;
  try {
    const archiveUrl = new URL(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive`
    );
    archiveUrl.searchParams.set("access_token", token);
    archiveUrl.searchParams.set("search_terms", "game");
    archiveUrl.searchParams.set("ad_type", "ALL");
    archiveUrl.searchParams.set("ad_active_status", "ALL");
    archiveUrl.searchParams.set("ad_reached_countries", JSON.stringify(["US"]));
    archiveUrl.searchParams.set("fields", "id,page_name");
    archiveUrl.searchParams.set("limit", "1");

    const resp = await fetch(archiveUrl.toString(), {
      signal: AbortSignal.timeout(15_000),
    });
    appUsage = parseAppUsageHeader(resp.headers.get("x-app-usage"));
    buUsage = resp.headers.get("x-business-use-case-usage");
    if (resp.ok) {
      archiveOk = true;
    } else {
      const body = await resp.text().catch(() => "");
      archiveError = `HTTP ${resp.status}: ${body.slice(0, 200)}`;
    }
  } catch (err) {
    archiveError = err instanceof Error ? err.message : String(err);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt =
    debug?.data_access_expires_at ?? debug?.expires_at ?? null;
  const expiresInDays =
    expiresAt && expiresAt > 0 ? Math.round((expiresAt - now) / 86400) : null;
  const neverExpires = expiresAt === 0 || expiresAt === null;

  return Response.json({
    ok: archiveOk && !debugError,
    token: {
      isValid: debug?.is_valid ?? null,
      type: debug?.type ?? null,
      appId: debug?.app_id ?? null,
      scopes: debug?.scopes ?? [],
      neverExpires,
      expiresInDays,
      expiresAt,
      debugError,
    },
    archive: {
      ok: archiveOk,
      error: archiveError,
    },
    rateLimit: {
      // x-app-usage: {"call_count":%, "total_cputime":%, "total_time":%}
      // (percentages of the app-level limit)
      appUsage,
      // x-business-use-case-usage: verbose JSON with ads_read / etc. usage.
      businessUseCaseUsage: buUsage,
    },
    hints: [
      !archiveOk && "Token can't read ads_archive — check scopes (ads_read required).",
      debug?.type === "USER" &&
        !neverExpires &&
        expiresInDays !== null &&
        expiresInDays < 14 &&
        "User token expires soon — switch to a system-user token for long-running scrapers.",
      neverExpires &&
        debug?.type?.includes("SYSTEM") &&
        "System-user token detected — good for scheduled scrapers.",
    ].filter(Boolean),
  });
}
