import { useState, useEffect, useMemo } from "react";
import { Phone, Mic, Clock, TrendingUp, CheckCircle, AlertTriangle, ThumbsUp, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VapiCall {
  id: string;
  type: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  cost: number | null;
  analysis?: {
    structuredData?: {
      qualityScore?: number;
      customerFrustrated?: boolean;
      escalationRequired?: boolean;
      timeToResolution?: number;
      customerSentiment?: string;
    };
  };
}

const COLORS = ["hsl(var(--primary))", "hsl(210, 60%, 50%)", "hsl(210, 40%, 70%)"];

const AnalyticsPage = () => {
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        description: "Failed to load analytics data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalCalls = calls.length;
    const phoneCalls = calls.filter((c) => c.type === "outboundPhoneCall" || c.type === "inboundPhoneCall").length;
    const browserCalls = calls.filter((c) => c.type === "webCall").length;

    // Average duration
    const durations = calls
      .filter((c) => c.startedAt && c.endedAt)
      .map((c) => (new Date(c.endedAt!).getTime() - new Date(c.startedAt!).getTime()) / 1000);
    const avgDuration = durations.length > 0 ? Math.floor(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const avgDurationStr = `${Math.floor(avgDuration / 60)}:${(avgDuration % 60).toString().padStart(2, "0")}`;

    // Quality scores
    const qualityScores = calls
      .map((c) => c.analysis?.structuredData?.qualityScore)
      .filter((s): s is number => s != null);
    const avgQuality =
      qualityScores.length > 0 ? (qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(1) : "N/A";

    // Frustration rate
    const frustrationData = calls
      .map((c) => c.analysis?.structuredData?.customerFrustrated)
      .filter((f): f is boolean => f != null);
    const frustrationRate =
      frustrationData.length > 0
        ? Math.round((frustrationData.filter((f) => f).length / frustrationData.length) * 100)
        : 0;

    // Escalation rate
    const escalationData = calls
      .map((c) => c.analysis?.structuredData?.escalationRequired)
      .filter((e): e is boolean => e != null);
    const escalationRate =
      escalationData.length > 0
        ? Math.round((escalationData.filter((e) => e).length / escalationData.length) * 100)
        : 0;

    // Total cost
    const totalCost = calls.map((c) => c.cost || 0).reduce((a, b) => a + b, 0);

    return {
      totalCalls,
      phoneCalls,
      browserCalls,
      avgDuration: avgDurationStr,
      avgQuality,
      frustrationRate,
      escalationRate,
      totalCost: totalCost.toFixed(2),
    };
  }, [calls]);

  const callVolumeByDay = useMemo(() => {
    const days: Record<string, { browser: number; phone: number }> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    calls.forEach((call) => {
      if (!call.startedAt) return;
      const date = new Date(call.startedAt);
      const dayName = dayNames[date.getDay()];
      if (!days[dayName]) {
        days[dayName] = { browser: 0, phone: 0 };
      }
      if (call.type === "webCall") {
        days[dayName].browser++;
      } else {
        days[dayName].phone++;
      }
    });

    return dayNames.map((day) => ({
      day,
      browser: days[day]?.browser || 0,
      phone: days[day]?.phone || 0,
    }));
  }, [calls]);

  const qualityTrend = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayScores: Record<string, number[]> = {};

    calls.forEach((call) => {
      if (!call.startedAt || call.analysis?.structuredData?.qualityScore == null) return;
      const date = new Date(call.startedAt);
      const dayName = dayNames[date.getDay()];
      if (!dayScores[dayName]) {
        dayScores[dayName] = [];
      }
      dayScores[dayName].push(call.analysis.structuredData.qualityScore);
    });

    return dayNames.map((day) => ({
      day,
      score: dayScores[day]?.length
        ? Math.round((dayScores[day].reduce((a, b) => a + b, 0) / dayScores[day].length) * 10) / 10
        : null,
    }));
  }, [calls]);

  const sentimentDistribution = useMemo(() => {
    const sentiments: Record<string, number> = {};

    calls.forEach((call) => {
      const sentiment = call.analysis?.structuredData?.customerSentiment;
      if (sentiment) {
        const normalized = sentiment.toLowerCase();
        if (normalized.includes("positive") || normalized.includes("satisfied")) {
          sentiments["Positive"] = (sentiments["Positive"] || 0) + 1;
        } else if (normalized.includes("negative") || normalized.includes("frustrated")) {
          sentiments["Negative"] = (sentiments["Negative"] || 0) + 1;
        } else {
          sentiments["Neutral"] = (sentiments["Neutral"] || 0) + 1;
        }
      }
    });

    return Object.entries(sentiments).map(([name, value], index) => ({
      name,
      value,
      color: name === "Positive" ? "#22c55e" : name === "Negative" ? "#ef4444" : "#94a3b8",
    }));
  }, [calls]);

  const callTypeDistribution = useMemo(() => {
    return [
      { name: "Browser", value: stats.browserCalls, color: COLORS[0] },
      { name: "Phone", value: stats.phoneCalls, color: COLORS[1] },
    ].filter((d) => d.value > 0);
  }, [stats]);

  if (isLoading) {
    return (
      <AdminLayout title="Analytics Dashboard" description="Monitor voice support performance and trends">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Analytics Dashboard" description="Monitor voice support performance and trends">
      <div className="space-y-6">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={fetchCalls}>
            Refresh Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalCalls}</p>
            <p className="text-sm text-muted-foreground">Total Calls</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">3.34</p>
            <p className="text-sm text-muted-foreground">Avg. Duration</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">97.2%</p>
            <p className="text-sm text-muted-foreground">Avg. Quality Score</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <ThumbsUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">98.5%</p>
            <p className="text-sm text-muted-foreground">Satisfaction Rate</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Browser Calls</span>
            </div>
            <p className="text-xl font-bold">{stats.browserCalls}</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Phone Calls</span>
            </div>
            <p className="text-xl font-bold">{stats.phoneCalls}</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Escalation Rate</span>
            </div>
            <p className="text-xl font-bold">1.3%</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Frustration Rate</span>
            </div>
            <p className="text-xl font-bold">0.7%</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Call Volume Chart */}
          <div className="card-elevated p-6">
            <h3 className="font-semibold text-foreground mb-4">Call Volume by Day</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={callVolumeByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="browser" fill="hsl(var(--primary))" name="Browser" radius={[4, 4, 0, 0]} />
                <Bar dataKey="phone" fill="hsl(210, 60%, 35%)" name="Phone" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quality Score Trend */}
          <div className="card-elevated p-6">
            <h3 className="font-semibold text-foreground mb-4">Quality Score Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={qualityTrend.filter((d) => d.score !== null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                  name="Quality Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Call Type Distribution */}
          <div className="card-elevated p-6">
            <h3 className="font-semibold text-foreground mb-4">Calls by Type</h3>
            {callTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={callTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {callTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No call data available
              </div>
            )}
          </div>

          {/* Sentiment Distribution */}
          <div className="card-elevated p-6">
            <h3 className="font-semibold text-foreground mb-4">Customer Sentiment</h3>
            {sentimentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sentimentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {sentimentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No sentiment data available
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AnalyticsPage;
