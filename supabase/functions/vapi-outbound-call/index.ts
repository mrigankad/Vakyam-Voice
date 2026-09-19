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
    let PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");

    if (!VAPI_API_KEY) throw new Error("API key is not configured");
    if (!VAPI_ASSISTANT_ID) throw new Error("Assistant ID is not configured");

    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format E.164
    let cleanedNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (cleanedNumber.startsWith("00")) cleanedNumber = "+" + cleanedNumber.slice(2);
    if (!cleanedNumber.startsWith("+")) cleanedNumber = "+" + cleanedNumber;
    const formattedNumber = cleanedNumber.replace(/^\+0+/, "+");

    // Vapi-managed numbers are limited to US national calling.
    if (!/^\+1[2-9]\d{9}$/.test(formattedNumber)) {
      return new Response(
        JSON.stringify({ error: "A valid US phone number in +1 E.164 format is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If no phone number ID configured, fetch the first one available on the Vapi account
    if (!PHONE_NUMBER_ID) {
      console.log("No VAPI_PHONE_NUMBER_ID configured, fetching from Vapi account...");
      const phoneListRes = await fetch("https://api.vapi.ai/phone-number", {
        headers: { "Authorization": `Bearer ${VAPI_API_KEY}` },
      });

      if (!phoneListRes.ok) {
        const errText = await phoneListRes.text();
        console.error("Failed to list phone numbers:", phoneListRes.status, errText);
        throw new Error("Failed to fetch phone numbers from Vapi account");
      }

      const phoneList = await phoneListRes.json();
      if (!Array.isArray(phoneList) || phoneList.length === 0) {
        throw new Error("No phone numbers found in your Vapi account. Please add one in the Vapi dashboard.");
      }

      PHONE_NUMBER_ID = phoneList[0].id;
      console.log("Using phone number ID from account:", PHONE_NUMBER_ID);
    }

    console.log("Initiating outbound call to:", formattedNumber);

    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: VAPI_ASSISTANT_ID,
        phoneNumberId: PHONE_NUMBER_ID,
        customer: { number: formattedNumber },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to initiate call:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Vapi error: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callData = await response.json();
    console.log("Call initiated successfully:", callData.id);

    return new Response(
      JSON.stringify({ success: true, callId: callData.id, message: "Call initiated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in vapi-outbound-call:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
