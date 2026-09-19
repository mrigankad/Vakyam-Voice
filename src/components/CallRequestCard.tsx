import { Phone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const CallRequestCard = () => {
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const formatPhoneNumber = (value: string) => {
    // Allow only digits and + for country code
    return value.replace(/[^\d+]/g, "");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const handleCallRequest = async () => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (!/^1[2-9]\d{9}$/.test(digits)) {
      toast({
        title: "US number required",
        description: "Vapi-managed numbers can call US numbers only. Enter +1 followed by 10 digits.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-outbound-call", {
        body: { phoneNumber: digits },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.success) {
        toast({
          title: "Call Initiated",
          description: "You will receive a call shortly from our AI assistant.",
        });
        setPhoneNumber("+1");
      } else {
        throw new Error(data?.error || "Failed to initiate call");
      }
    } catch (error) {
      console.error("Failed to initiate call:", error);
      toast({
        title: "Call Failed",
        description: "Unable to initiate the call. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card-elevated flex flex-col items-center p-6 text-center">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-wayam">Phone support</p>
      <h3 className="font-display text-display-sm text-foreground">Call Meera</h3>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Speak with the Club Mahindra bilingual concierge by phone</p>
      
      <div className="phone-circle mb-4">
        <Phone className="w-6 h-6 text-white" />
      </div>
      
      <a
        href="tel:+15139356231"
        className="mb-1 text-lg font-semibold text-foreground transition-colors hover:text-wayam"
      >
        +1 (513) 935-6231
      </a>
      <p className="mb-5 text-xs text-muted-foreground">US inbound calling</p>

      <p className="mb-2 text-sm font-medium text-foreground">Or request a US callback</p>
      
      <Input
        type="tel"
        placeholder="+1 513 555 0123"
        value={phoneNumber}
        onChange={handlePhoneChange}
        className="max-w-xs mb-3 text-center"
      />
      
      <Button onClick={handleCallRequest} disabled={isLoading} className="w-full max-w-xs">
        <Phone className="w-4 h-4 mr-2" />
        {isLoading ? "Initiating Call..." : "Call Me Now"}
      </Button>
      <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
        By requesting a call, you confirm that you own this number and consent to an automated AI voice call.
      </p>
    </div>
  );
};
