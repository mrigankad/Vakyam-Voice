import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL_NAME = "knowledge_query";

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

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Helper to find the existing knowledge_query tool
    async function findKnowledgeTool(): Promise<{ id: string; knowledgeBases: any[] } | null> {
      const response = await fetch("https://api.vapi.ai/tool", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to list tools:", response.status);
        return null;
      }

      const tools = await response.json();
      const queryTool = tools.find((t: any) => 
        t.type === "query" && t.function?.name === TOOL_NAME
      );

      return queryTool ? { id: queryTool.id, knowledgeBases: queryTool.knowledgeBases || [] } : null;
    }

    // GET: List all knowledge bases in the tool
    if (action === "get") {
      const tool = await findKnowledgeTool();
      
      if (!tool) {
        return new Response(
          JSON.stringify({ success: true, knowledgeBases: [], toolId: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, knowledgeBases: tool.knowledgeBases, toolId: tool.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE: Create a new knowledge base
    if (action === "createKnowledgeBase") {
      const { name, description } = body;
      
      if (!name) {
        throw new Error("name is required");
      }

      const tool = await findKnowledgeTool();
      
      const newKnowledgeBase = {
        provider: "google",
        name: name,
        description: description || `Knowledge base for ${name}`,
        fileIds: [],
      };

      if (tool) {
        // Update existing tool with new knowledge base
        const updatedKnowledgeBases = [...tool.knowledgeBases, newKnowledgeBase];
        
        const response = await fetch(`https://api.vapi.ai/tool/${tool.id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            knowledgeBases: updatedKnowledgeBases,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to update tool:", response.status, errorText);
          throw new Error(`Failed to update tool: ${response.status}`);
        }

        const updatedTool = await response.json();
        return new Response(
          JSON.stringify({ success: true, knowledgeBases: updatedTool.knowledgeBases, toolId: tool.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Create new tool
        const response = await fetch("https://api.vapi.ai/tool", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "query",
            function: {
              name: TOOL_NAME,
            },
            knowledgeBases: [newKnowledgeBase],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to create tool:", response.status, errorText);
          throw new Error(`Failed to create tool: ${response.status}`);
        }

        const newTool = await response.json();
        
        // Attach to assistant if we have one
        if (VAPI_ASSISTANT_ID) {
          await attachToolToAssistant(VAPI_API_KEY, VAPI_ASSISTANT_ID, newTool.id);
        }

        return new Response(
          JSON.stringify({ success: true, knowledgeBases: newTool.knowledgeBases, toolId: newTool.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ADD FILE: Add a file to a specific knowledge base
    if (action === "addFile") {
      const { knowledgeBaseName, fileId } = body;
      
      if (!knowledgeBaseName || !fileId) {
        throw new Error("knowledgeBaseName and fileId are required");
      }

      const tool = await findKnowledgeTool();
      
      if (!tool) {
        throw new Error("Knowledge tool not found. Create a knowledge base first.");
      }

      const updatedKnowledgeBases = tool.knowledgeBases.map((kb: any) => {
        if (kb.name === knowledgeBaseName) {
          const existingFileIds = kb.fileIds || [];
          if (!existingFileIds.includes(fileId)) {
            return { ...kb, fileIds: [...existingFileIds, fileId] };
          }
        }
        return kb;
      });

      const response = await fetch(`https://api.vapi.ai/tool/${tool.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledgeBases: updatedKnowledgeBases,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to add file to KB:", response.status, errorText);
        throw new Error(`Failed to add file: ${response.status}`);
      }

      const updatedTool = await response.json();
      return new Response(
        JSON.stringify({ success: true, knowledgeBases: updatedTool.knowledgeBases }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REMOVE FILE: Remove a file from a knowledge base
    if (action === "removeFile") {
      const { knowledgeBaseName, fileId } = body;
      
      if (!knowledgeBaseName || !fileId) {
        throw new Error("knowledgeBaseName and fileId are required");
      }

      const tool = await findKnowledgeTool();
      
      if (!tool) {
        throw new Error("Knowledge tool not found");
      }

      const updatedKnowledgeBases = tool.knowledgeBases.map((kb: any) => {
        if (kb.name === knowledgeBaseName) {
          return { ...kb, fileIds: (kb.fileIds || []).filter((id: string) => id !== fileId) };
        }
        return kb;
      });

      const response = await fetch(`https://api.vapi.ai/tool/${tool.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledgeBases: updatedKnowledgeBases,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to remove file:", response.status, errorText);
        throw new Error(`Failed to remove file: ${response.status}`);
      }

      const updatedTool = await response.json();
      return new Response(
        JSON.stringify({ success: true, knowledgeBases: updatedTool.knowledgeBases }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE KNOWLEDGE BASE
    if (action === "deleteKnowledgeBase") {
      const { knowledgeBaseName } = body;
      
      if (!knowledgeBaseName) {
        throw new Error("knowledgeBaseName is required");
      }

      const tool = await findKnowledgeTool();
      
      if (!tool) {
        throw new Error("Knowledge tool not found");
      }

      const updatedKnowledgeBases = tool.knowledgeBases.filter((kb: any) => kb.name !== knowledgeBaseName);

      const response = await fetch(`https://api.vapi.ai/tool/${tool.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledgeBases: updatedKnowledgeBases,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to delete KB:", response.status, errorText);
        throw new Error(`Failed to delete knowledge base: ${response.status}`);
      }

      const updatedTool = await response.json();
      return new Response(
        JSON.stringify({ success: true, knowledgeBases: updatedTool.knowledgeBases }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-knowledge-tool:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function attachToolToAssistant(apiKey: string, assistantId: string, toolId: string) {
  try {
    // Get current assistant config
    const getResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!getResponse.ok) {
      console.error("Failed to get assistant for tool attach");
      return;
    }

    const assistant = await getResponse.json();
    const currentToolIds = assistant.model?.toolIds || [];
    
    if (!currentToolIds.includes(toolId)) {
      const updatedToolIds = [...currentToolIds, toolId];
      
      await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: {
            ...assistant.model,
            toolIds: updatedToolIds,
          },
        }),
      });
    }
  } catch (error) {
    console.error("Failed to attach tool to assistant:", error);
  }
}
