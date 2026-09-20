import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const encoder = new TextEncoder();

const toBase64Url = (value: string | ArrayBuffer) => {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const createPublicToken = async (
  privateKey: string,
  orgId: string,
  assistantId: string,
  allowedOrigins: string[],
) => {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({
    orgId,
    token: {
      tag: "public",
      restrictions: {
        enabled: true,
        allowedOrigins,
        allowedAssistantIds: [assistantId],
        allowTransientAssistant: false,
      },
    },
    iat: now,
    exp: now + 10 * 60,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(privateKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${toBase64Url(signature)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("VAPI_API_KEY");
    const assistantId = Deno.env.get("VAPI_ASSISTANT_ID");
    const orgId = Deno.env.get("VAPI_ORG_ID");
    if (!apiKey) throw new Error("VAPI_API_KEY is not configured");
    if (!assistantId) throw new Error("VAPI_ASSISTANT_ID is not configured");
    if (!orgId) throw new Error("VAPI_ORG_ID is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only origins listed in the VAPI_ALLOWED_ORIGINS secret may use the
    // minted token. Never trust the request's Origin header here: doing so
    // would let any site mint a token valid for itself. Production domains
    // (e.g. https://vakyam-voice.wayam.ai) must be added to the secret.
    const allowedOrigins = (Deno.env.get("VAPI_ALLOWED_ORIGINS") ||
      "http://localhost:8080,http://127.0.0.1:8080")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const token = await createPublicToken(apiKey, orgId, assistantId, allowedOrigins);

    return new Response(JSON.stringify({ assistantId, token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-web-token:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
