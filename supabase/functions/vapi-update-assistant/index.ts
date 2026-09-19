import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
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

    const { action, firstMessage, systemPrompt, voiceSpeed } = await req.json();

    if (action === "get") {
      // Fetch current assistant configuration
      const response = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vapi GET error:", response.status, errorText);
        throw new Error(`Failed to fetch assistant: ${response.status}`);
      }

      const assistant = await response.json();
      
      // Extract the relevant fields
      const currentFirstMessage = assistant.firstMessage || "";
      const currentSystemPrompt = assistant.model?.messages?.find(
        (m: { role: string }) => m.role === "system"
      )?.content || "";

      return new Response(
        JSON.stringify({ 
          firstMessage: currentFirstMessage,
          systemPrompt: currentSystemPrompt,
          voiceSpeed: assistant.voice?.speed,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (action === "update") {
      if (firstMessage === undefined && systemPrompt === undefined && voiceSpeed === undefined) {
        throw new Error("No updates provided");
      }

      if (voiceSpeed !== undefined &&
          (typeof voiceSpeed !== "number" || voiceSpeed < 0.5 || voiceSpeed > 2)) {
        throw new Error("voiceSpeed must be a number between 0.5 and 2");
      }

      // First fetch current assistant to preserve model config
      const getResponse = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!getResponse.ok) {
        const errorText = await getResponse.text();
        console.error("Vapi GET error:", getResponse.status, errorText);
        throw new Error(`Failed to fetch assistant: ${getResponse.status}`);
      }

      const currentAssistant = await getResponse.json();

      // Build the update payload
      const updatePayload: Record<string, unknown> = {};

      if (firstMessage !== undefined) {
        updatePayload.firstMessage = firstMessage;
      }

      if (systemPrompt !== undefined) {
        // Preserve existing model config (provider, model name, etc.) and only update messages
        const currentModel = currentAssistant.model || {};
        const existingMessages = currentModel.messages || [];
        
        // Find and update system message, or add it
        const otherMessages = existingMessages.filter((m: { role: string }) => m.role !== "system");
        const updatedMessages = [
          { role: "system", content: systemPrompt },
          ...otherMessages,
        ];

        updatePayload.model = {
          ...currentModel,
          messages: updatedMessages,
        };
      }

      if (voiceSpeed !== undefined) {
        updatePayload.voice = {
          ...(currentAssistant.voice || {}),
          speed: voiceSpeed,
        };
      }

      const response = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vapi PATCH error:", response.status, errorText);
        throw new Error(`Failed to update assistant: ${response.status}`);
      }

      const updatedAssistant = await response.json();

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Assistant updated successfully",
          assistant: {
            id: updatedAssistant.id,
            firstMessage: updatedAssistant.firstMessage,
            voiceSpeed: updatedAssistant.voice?.speed,
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    throw new Error("Invalid action. Use 'get' or 'update'");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-update-assistant:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
