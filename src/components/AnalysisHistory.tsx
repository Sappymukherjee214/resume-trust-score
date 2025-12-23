import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar, ChevronRight, Inbox } from "lucide-react";

interface AnalysisResultData {
  id: string;
  credibility_score: number;
  risk_level: string;
  flags: Array<{ category: string; severity: string; description: string }>;
  summary: string;
  detailed_analysis: {
    experience_consistency: string;
    skills_alignment: string;
    achievements_credibility: string;
    overall_authenticity: string;
  };
  created_at: string;
  resume: {
    file_name: string;
  };
}

interface AnalysisHistoryProps {
  onSelectAnalysis: (analysis: AnalysisResultData) => void;
}

export const AnalysisHistory = ({ onSelectAnalysis }: AnalysisHistoryProps) => {
  const [analyses, setAnalyses] = useState<AnalysisResultData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from("analysis_results")
        .select(`
          id,
          credibility_score,
          risk_level,
          flags,
          summary,
          detailed_analysis,
          created_at,
          resumes (
            file_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Transform the data to match expected format
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        resume: {
          file_name: item.resumes?.file_name || "Unknown file"
        }
      }));

      setAnalyses(formattedData);
    } catch (error) {
      console.error("Error fetching analyses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadgeStyles = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "high":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Analysis History</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Once you analyze your first resume, it will appear here for future reference.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Analysis History
          <span className="text-sm font-normal text-muted-foreground">
            {analyses.length} {analyses.length === 1 ? "result" : "results"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyses.map((analysis) => (
          <button
            key={analysis.id}
            onClick={() => onSelectAnalysis(analysis)}
            className="w-full flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {analysis.resume.file_name}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(analysis.created_at)}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <span className={`text-lg font-bold ${getScoreColor(analysis.credibility_score)}`}>
                  {analysis.credibility_score}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <Badge className={`${getRiskBadgeStyles(analysis.risk_level)} capitalize`}>
                {analysis.risk_level}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
