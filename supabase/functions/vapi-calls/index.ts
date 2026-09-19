import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");

    if (!VAPI_API_KEY) {
      throw new Error("API key is not configured");
    }

    const url = new URL(req.url);
    const limit = url.searchParams.get("limit") || "100";
    const callId = url.searchParams.get("callId");

    // If a specific call ID is provided, fetch that call
    if (callId) {
      const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch call:", response.status, errorText);
        throw new Error(`Failed to fetch call: ${response.status}`);
      }

      const call = await response.json();
      return new Response(
        JSON.stringify({ call }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query params for listing calls
    const params = new URLSearchParams();
    params.append("limit", limit);
    if (VAPI_ASSISTANT_ID) {
      params.append("assistantId", VAPI_ASSISTANT_ID);
    }

    console.log("Fetching calls with params:", params.toString());

    const response = await fetch(`https://api.vapi.ai/call?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch calls:", response.status, errorText);
      throw new Error(`Failed to fetch calls: ${response.status}`);
    }

    const calls = await response.json();
    console.log(`Fetched ${calls.length} calls`);

    return new Response(
      JSON.stringify({ calls }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-calls:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
