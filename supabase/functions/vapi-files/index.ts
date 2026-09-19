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

    if (!VAPI_API_KEY) {
      throw new Error("VAPI_API_KEY is not configured");
    }

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();

    if (action === "list") {
      // List all files
      const response = await fetch("https://api.vapi.ai/file", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vapi list files error:", response.status, errorText);
        throw new Error(`Failed to list files: ${response.status}`);
      }

      const files = await response.json();
      return new Response(
        JSON.stringify({ success: true, files }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { fileId } = await req.json();
      
      if (!fileId) {
        throw new Error("fileId is required for delete action");
      }

      const response = await fetch(`https://api.vapi.ai/file/${fileId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vapi delete file error:", response.status, errorText);
        throw new Error(`Failed to delete file: ${response.status}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "File deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action. Use 'list' or 'delete'");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-files:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});