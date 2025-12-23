import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle, XCircle, FileText, Calendar } from "lucide-react";

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

interface AnalysisResultProps {
  analysis: AnalysisResultData;
}

export const AnalysisResult = ({ analysis }: AnalysisResultProps) => {
  const getRiskColor = (level: string) => {
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

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "low":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "high":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{analysis.resume.file_name}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                {formatDate(analysis.created_at)}
              </div>
            </div>
          </div>
          <Badge className={`${getRiskColor(analysis.risk_level)} capitalize`}>
            {analysis.risk_level} Risk
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Credibility Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Credibility Score</span>
            <span className={`text-2xl font-bold ${getScoreColor(analysis.credibility_score)}`}>
              {analysis.credibility_score}/100
            </span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${getProgressColor(analysis.credibility_score)}`}
              style={{ width: `${analysis.credibility_score}%` }}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.summary}
          </p>
        </div>

        <Separator />

        {/* Red Flags */}
        {analysis.flags && analysis.flags.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Red Flags ({analysis.flags.length})
            </h4>
            <div className="space-y-2">
              {analysis.flags.map((flag, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  {getSeverityIcon(flag.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{flag.category}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {flag.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Analysis */}
        {analysis.detailed_analysis && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Detailed Analysis</h4>
              <div className="grid gap-3">
                {Object.entries(analysis.detailed_analysis).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {key.replace(/_/g, " ")}
                    </span>
                    <p className="text-sm text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
