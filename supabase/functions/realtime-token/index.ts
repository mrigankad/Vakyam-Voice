import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildDemoContext } from "./inventory.ts";
import { FIRST_MESSAGE, INSTRUCTIONS, TEXT_INSTRUCTIONS } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resource = Deno.env.get("AZURE_OPENAI_RESOURCE");
    const apiKey = Deno.env.get("AZURE_OPENAI_API_KEY");
    const deployment = Deno.env.get("AZURE_REALTIME_DEPLOYMENT");
    const voice = Deno.env.get("AZURE_REALTIME_VOICE") || "marin";
    if (!resource) throw new Error("AZURE_OPENAI_RESOURCE is not configured");
    if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not configured");
    if (!deployment) throw new Error("AZURE_REALTIME_DEPLOYMENT is not configured");

    // With an Azure Speech resource configured, the model replies in text and
    // the browser speaks it with a native Indian Azure voice instead.
    const speechKey = Deno.env.get("AZURE_SPEECH_KEY");
    const speechRegion = Deno.env.get("AZURE_SPEECH_REGION");
    const speechVoice = Deno.env.get("AZURE_SPEECH_VOICE") || "en-IN-AartiIndicNeural";
    const indianVoice = Boolean(speechKey && speechRegion);

    // Only a signed-in user may start a call. The bearer value alone proves
    // nothing (the publishable key is also sent as a bearer), so ask Supabase
    // Auth whether it is a live user session.
    const authHeader = req.headers.get("Authorization");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    const userResponse = authHeader?.startsWith("Bearer ")
      ? await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: supabaseKey },
        })
      : null;
    if (!userResponse?.ok) return json({ error: "Unauthorized" }, 401);

    // The prompt and voice are fixed here, server-side. The browser only gets
    // a short-lived token bound to this session configuration.
    const base = `https://${resource}.openai.azure.com/openai/v1/realtime`;
    const session = indianVoice
      ? { output_modalities: ["text"], instructions: TEXT_INSTRUCTIONS }
      : { audio: { output: { voice } }, instructions: INSTRUCTIONS };
    const [tokenResponse, speechResponse] = await Promise.all([
      fetch(`${base}/client_secrets`, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: deployment,
            ...session,
            instructions: [session.instructions, buildDemoContext()].join("\n\n"),
          },
        }),
      }),
      // A Speech token lasts ten minutes, as long as the longest call.
      indianVoice
        ? fetch(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
            method: "POST",
            headers: { "Ocp-Apim-Subscription-Key": speechKey!, "Content-Length": "0" },
          })
        : null,
    ]);

    if (!tokenResponse.ok) {
      console.error("Azure token error:", tokenResponse.status, await tokenResponse.text());
      throw new Error(`Azure refused the session (${tokenResponse.status})`);
    }
    if (speechResponse && !speechResponse.ok) {
      console.error("Azure Speech token error:", speechResponse.status, await speechResponse.text());
      throw new Error(`Azure Speech refused the session (${speechResponse.status})`);
    }

    const { value: token } = await tokenResponse.json();
    if (!token) throw new Error("Azure returned no session token");
    const speech = speechResponse
      ? { token: await speechResponse.text(), region: speechRegion, voice: speechVoice }
      : undefined;

    // webrtcfilter=on keeps the prompt out of the events sent to the browser.
    return json({ token, callUrl: `${base}/calls?webrtcfilter=on`, firstMessage: FIRST_MESSAGE, speech });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in realtime-token:", message);
    return json({ error: message }, 500);
  }
});
