import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import { format, subDays, subMonths, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";

interface AnalysisData {
  id: string;
  risk_level: string;
  created_at: string;
}

interface ChartDataPoint {
  date: string;
  low: number;
  medium: number;
  high: number;
  total: number;
}

interface RiskTrendChartProps {
  userId: string;
}

export const RiskTrendChart = ({ userId }: RiskTrendChartProps) => {
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyses = async () => {
      setIsLoading(true);
      const startDate = timeRange === "7d" 
        ? subDays(new Date(), 7)
        : timeRange === "30d"
        ? subDays(new Date(), 30)
        : subMonths(new Date(), 3);

      const { data, error } = await supabase
        .from("analysis_results")
        .select("id, risk_level, created_at")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (!error && data) {
        setAnalyses(data);
      }
      setIsLoading(false);
    };

    fetchAnalyses();
  }, [userId, timeRange]);

  const chartData = useMemo(() => {
    const now = new Date();
    const startDate = timeRange === "7d" 
      ? subDays(now, 7)
      : timeRange === "30d"
      ? subDays(now, 30)
      : subMonths(now, 3);

    // For longer ranges, group by week
    const useWeekly = timeRange === "90d";

    if (useWeekly) {
      const weeks = eachWeekOfInterval({ start: startDate, end: now });
      return weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart);
        const weekAnalyses = analyses.filter((a) => {
          const date = new Date(a.created_at);
          return date >= weekStart && date <= weekEnd;
        });

        return {
          date: format(weekStart, "MMM d"),
          low: weekAnalyses.filter((a) => a.risk_level === "low").length,
          medium: weekAnalyses.filter((a) => a.risk_level === "medium").length,
          high: weekAnalyses.filter((a) => a.risk_level === "high").length,
          total: weekAnalyses.length
        };
      });
    }

    const days = eachDayOfInterval({ start: startDate, end: now });
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayAnalyses = analyses.filter((a) => 
        format(new Date(a.created_at), "yyyy-MM-dd") === dayStr
      );

      return {
        date: format(day, timeRange === "7d" ? "EEE" : "MMM d"),
        low: dayAnalyses.filter((a) => a.risk_level === "low").length,
        medium: dayAnalyses.filter((a) => a.risk_level === "medium").length,
        high: dayAnalyses.filter((a) => a.risk_level === "high").length,
        total: dayAnalyses.length
      };
    });
  }, [analyses, timeRange]);

  const totals = useMemo(() => {
    return {
      low: analyses.filter((a) => a.risk_level === "low").length,
      medium: analyses.filter((a) => a.risk_level === "medium").length,
      high: analyses.filter((a) => a.risk_level === "high").length,
      total: analyses.length
    };
  }, [analyses]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Risk Distribution Trends
            </CardTitle>
            <CardDescription>
              Analysis risk levels over time
            </CardDescription>
          </div>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-foreground">{totals.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-chart-1/10">
            <div className="text-2xl font-bold text-chart-1">{totals.low}</div>
            <div className="text-xs text-muted-foreground">Low Risk</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-chart-4/10">
            <div className="text-2xl font-bold text-chart-4">{totals.medium}</div>
            <div className="text-xs text-muted-foreground">Medium</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <div className="text-2xl font-bold text-destructive">{totals.high}</div>
            <div className="text-xs text-muted-foreground">High Risk</div>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        ) : analyses.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No analysis data yet</p>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))"
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="low" 
                  name="Low Risk"
                  stroke="hsl(var(--chart-1))" 
                  fillOpacity={1} 
                  fill="url(#colorLow)" 
                  stackId="1"
                />
                <Area 
                  type="monotone" 
                  dataKey="medium" 
                  name="Medium Risk"
                  stroke="hsl(var(--chart-4))" 
                  fillOpacity={1} 
                  fill="url(#colorMedium)" 
                  stackId="1"
                />
                <Area 
                  type="monotone" 
                  dataKey="high" 
                  name="High Risk"
                  stroke="hsl(var(--destructive))" 
                  fillOpacity={1} 
                  fill="url(#colorHigh)" 
                  stackId="1"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
