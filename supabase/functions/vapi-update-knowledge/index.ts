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
      throw new Error("VAPI_API_KEY is not configured");
    }

    if (!VAPI_ASSISTANT_ID) {
      throw new Error("VAPI_ASSISTANT_ID is not configured");
    }

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileIds } = await req.json();

    if (!Array.isArray(fileIds)) {
      throw new Error("fileIds must be an array");
    }

    console.log("Updating assistant knowledge base with files:", fileIds);

    // First get the current assistant config to preserve model settings
    const getResponse = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error("Vapi GET assistant error:", getResponse.status, errorText);
      throw new Error(`Failed to get assistant: ${getResponse.status}`);
    }

    const assistant = await getResponse.json();
    
    // Build the knowledge base configuration with file IDs
    // Vapi uses model.knowledgeBase for file-based knowledge
    const updatePayload: Record<string, unknown> = {};

    if (fileIds.length > 0) {
      // Create knowledge base config referencing the files
      updatePayload.knowledgeBase = {
        provider: "canonical",
        fileIds: fileIds,
      };
    } else {
      // Remove knowledge base if no files
      updatePayload.knowledgeBase = null;
    }

    // Update the assistant
    const updateResponse = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("Vapi PATCH assistant error:", updateResponse.status, errorText);
      throw new Error(`Failed to update assistant: ${updateResponse.status}`);
    }

    const updatedAssistant = await updateResponse.json();
    console.log("Assistant updated with knowledge base");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Assistant updated with ${fileIds.length} files`,
        knowledgeBase: updatedAssistant.knowledgeBase,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-update-knowledge:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});