import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle, XCircle, FileText, X, ArrowRight, ArrowLeft, Equal } from "lucide-react";

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

interface ComparisonViewProps {
  analysisA: AnalysisResultData;
  analysisB: AnalysisResultData;
  onClose: () => void;
  onRemove: (which: 'A' | 'B') => void;
}

export const ComparisonView = ({ analysisA, analysisB, onClose, onRemove }: ComparisonViewProps) => {
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

  const getComparisonIndicator = (scoreA: number, scoreB: number) => {
    if (scoreA > scoreB) return <ArrowLeft className="h-4 w-4 text-green-500" />;
    if (scoreA < scoreB) return <ArrowRight className="h-4 w-4 text-green-500" />;
    return <Equal className="h-4 w-4 text-muted-foreground" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderAnalysisCard = (analysis: AnalysisResultData, label: string, which: 'A' | 'B') => (
    <div className="flex-1 min-w-0">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="flex-shrink-0">{label}</Badge>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{analysis.resume.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(analysis.created_at)}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => onRemove(which)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Score */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Credibility Score</p>
            <p className={`text-3xl font-bold ${getScoreColor(analysis.credibility_score)}`}>
              {analysis.credibility_score}
            </p>
            <Badge className={`mt-2 ${getRiskColor(analysis.risk_level)} capitalize`}>
              {analysis.risk_level} Risk
            </Badge>
          </div>

          {/* Summary */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm text-foreground">{analysis.summary}</p>
          </div>

          <Separator />

          {/* Flags */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Red Flags ({analysis.flags?.length || 0})
            </p>
            {analysis.flags && analysis.flags.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {analysis.flags.map((flag, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs p-2 bg-muted/30 rounded">
                    {flag.severity === 'high' && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />}
                    {flag.severity === 'medium' && <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />}
                    {flag.severity === 'low' && <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />}
                    <span className="text-muted-foreground">{flag.category}: {flag.description}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No flags found</p>
            )}
          </div>

          <Separator />

          {/* Detailed Analysis */}
          {analysis.detailed_analysis && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Detailed Analysis</p>
              {Object.entries(analysis.detailed_analysis).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs font-medium text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-foreground">{value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Comparison
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Score Comparison Banner */}
        <div className="flex items-center justify-center gap-4 p-4 mb-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <p className={`text-2xl font-bold ${getScoreColor(analysisA.credibility_score)}`}>
              {analysisA.credibility_score}
            </p>
            <p className="text-xs text-muted-foreground">Resume A</p>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            {getComparisonIndicator(analysisA.credibility_score, analysisB.credibility_score)}
            <p className="text-xs text-muted-foreground">
              {Math.abs(analysisA.credibility_score - analysisB.credibility_score)} pts diff
            </p>
          </div>
          
          <div className="text-center">
            <p className={`text-2xl font-bold ${getScoreColor(analysisB.credibility_score)}`}>
              {analysisB.credibility_score}
            </p>
            <p className="text-xs text-muted-foreground">Resume B</p>
          </div>
        </div>

        {/* Side by Side Cards */}
        <div className="flex gap-4 overflow-x-auto">
          {renderAnalysisCard(analysisA, 'A', 'A')}
          {renderAnalysisCard(analysisB, 'B', 'B')}
        </div>
      </CardContent>
    </Card>
  );
};
