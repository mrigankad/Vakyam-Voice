import { useState, useEffect } from "react";
import { Phone, Mic, Clock, Calendar, ChevronRight, Loader2, AlertTriangle, ThumbsUp, ThumbsDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VapiCall {
  id: string;
  type: string;
  status: string;
  endedReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cost: number | null;
  customer?: {
    number?: string;
  };
  analysis?: {
    summary?: string;
    structuredData?: {
      qualityScore?: number;
      customerFrustrated?: boolean;
      escalationRequired?: boolean;
      timeToResolution?: number;
      customerSentiment?: string;
      callSummary?: string;
    };
    successEvaluation?: string;
  };
  artifact?: {
    messages?: Array<{
      role: string;
      message?: string;
      content?: string;
      time?: number;
    }>;
    transcript?: string;
    recordingUrl?: string;
  };
}

const HistoryPage = () => {
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<VapiCall | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("vapi-calls", {
        body: {},
      });

      if (error) throw error;

      if (data?.calls) {
        setCalls(data.calls);
      }
    } catch (error) {
      console.error("Failed to fetch calls:", error);
      toast({
        title: "Error",
        description: "Failed to load call history.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (startedAt: string | null, endedAt: string | null) => {
    if (!startedAt || !endedAt) return "--:--";
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  };

  const getCallType = (type: string) => {
    if (type === "webCall") return "browser";
    if (type === "outboundPhoneCall" || type === "inboundPhoneCall") return "phone";
    return type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ended: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      queued: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      ringing: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    };
    return (
      <Badge variant="secondary" className={styles[status] || "bg-muted"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSentimentBadge = (sentiment: string | undefined) => {
    if (!sentiment) return null;
    const lower = sentiment.toLowerCase();
    if (lower.includes("positive") || lower.includes("satisfied")) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{sentiment}</Badge>;
    }
    if (lower.includes("negative") || lower.includes("frustrated")) {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">{sentiment}</Badge>;
    }
    return <Badge variant="secondary">{sentiment}</Badge>;
  };

  const getTranscriptMessages = (call: VapiCall) => {
    if (call.artifact?.messages && call.artifact.messages.length > 0) {
      return call.artifact.messages
        .filter((msg) => msg.role !== "system") // Filter out system prompts
        .map((msg) => ({
          role: msg.role === "assistant" || msg.role === "bot" ? "agent" : "user",
          text: msg.message || msg.content || "",
          time: msg.time ? `${Math.floor(msg.time / 60)}:${(Math.floor(msg.time) % 60).toString().padStart(2, "0")}` : "",
        }))
        .filter((msg) => msg.text); // Filter out empty messages
    }
    return [];
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Call History"
        description="View and analyze all voice support sessions"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Call History"
      description="View and analyze all voice support sessions"
    >
      <div className="card-elevated">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Recent Sessions</h2>
            <p className="text-sm text-muted-foreground">{calls.length} total sessions</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCalls}>
            Refresh
          </Button>
        </div>

        {calls.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No call history found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getCallType(call.type) === "phone" ? (
                        <Phone className="w-4 h-4 text-primary" />
                      ) : (
                        <Mic className="w-4 h-4 text-primary" />
                      )}
                      <span className="capitalize">{getCallType(call.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {call.customer?.number || "Browser Session"}
                  </TableCell>
                  <TableCell>
                    {call.analysis?.structuredData?.qualityScore != null ? (
                      <span className={`font-semibold ${
                        call.analysis.structuredData.qualityScore >= 7 
                          ? "text-green-600" 
                          : call.analysis.structuredData.qualityScore >= 4 
                            ? "text-yellow-600" 
                            : "text-red-600"
                      }`}>
                        {call.analysis.structuredData.qualityScore}/10
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getSentimentBadge(call.analysis?.structuredData?.customerSentiment)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {formatDuration(call.startedAt, call.endedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {formatDate(call.startedAt)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(call.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCall(call)}
                    >
                      View Details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCall && getCallType(selectedCall.type) === "phone" ? (
                <Phone className="w-5 h-5 text-primary" />
              ) : (
                <Mic className="w-5 h-5 text-primary" />
              )}
              Call Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedCall && (
            <ScrollArea className="max-h-[calc(85vh-100px)]">
              <div className="space-y-4 pr-4">
                {/* Overview Grid */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{getCallType(selectedCall.type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{formatDuration(selectedCall.startedAt, selectedCall.endedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    {getStatusBadge(selectedCall.status)}
                  </div>
                </div>

                {/* Structured Data Metrics */}
                {selectedCall.analysis?.structuredData && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Call Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedCall.analysis.structuredData.qualityScore != null && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Quality Score</p>
                          <p className={`text-2xl font-bold ${
                            selectedCall.analysis.structuredData.qualityScore >= 7 
                              ? "text-green-600" 
                              : selectedCall.analysis.structuredData.qualityScore >= 4 
                                ? "text-yellow-600" 
                                : "text-red-600"
                          }`}>
                            {selectedCall.analysis.structuredData.qualityScore}/10
                          </p>
                        </div>
                      )}
                      {selectedCall.analysis.structuredData.customerSentiment && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Customer Sentiment</p>
                          {getSentimentBadge(selectedCall.analysis.structuredData.customerSentiment)}
                        </div>
                      )}
                      {selectedCall.analysis.structuredData.timeToResolution != null && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Time to Resolution</p>
                          <p className="text-lg font-semibold">{selectedCall.analysis.structuredData.timeToResolution}s</p>
                        </div>
                      )}
                      {selectedCall.analysis.structuredData.customerFrustrated != null && (
                        <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                          {selectedCall.analysis.structuredData.customerFrustrated ? (
                            <>
                              <ThumbsDown className="w-5 h-5 text-red-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Customer Frustrated</p>
                                <p className="font-medium text-red-600">Yes</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <ThumbsUp className="w-5 h-5 text-green-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Customer Frustrated</p>
                                <p className="font-medium text-green-600">No</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {selectedCall.analysis.structuredData.escalationRequired != null && (
                        <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                          {selectedCall.analysis.structuredData.escalationRequired ? (
                            <>
                              <ArrowUpRight className="w-5 h-5 text-orange-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Escalation Required</p>
                                <p className="font-medium text-orange-600">Yes</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-5 h-5 text-muted-foreground opacity-50" />
                              <div>
                                <p className="text-xs text-muted-foreground">Escalation Required</p>
                                <p className="font-medium">No</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Call Summary */}
                {(selectedCall.analysis?.structuredData?.callSummary || selectedCall.analysis?.summary) && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Call Summary</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {selectedCall.analysis.structuredData?.callSummary || selectedCall.analysis.summary}
                    </p>
                  </div>
                )}

                {/* Transcript */}
                {getTranscriptMessages(selectedCall).length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Transcript</h3>
                    <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                      {getTranscriptMessages(selectedCall).map((entry, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-3 ${
                            entry.role === "agent" ? "" : "flex-row-reverse"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              entry.role === "agent"
                                ? "bg-muted"
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            <p className="text-sm">{entry.text}</p>
                            {entry.time && (
                              <p className={`text-xs mt-1 ${
                                entry.role === "agent" ? "text-muted-foreground" : "text-primary-foreground/70"
                              }`}>
                                {entry.time}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recording Link */}
                {selectedCall.artifact?.recordingUrl && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Recording</h3>
                    <audio controls className="w-full" src={selectedCall.artifact.recordingUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default HistoryPage;
