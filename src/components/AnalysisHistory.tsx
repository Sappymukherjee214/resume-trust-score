import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, ChevronRight, Inbox, Download, GitCompare, Filter, Search } from "lucide-react";
import { exportToCSV } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";

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
  onCompare?: (analyses: [AnalysisResultData, AnalysisResultData]) => void;
  comparisonMode?: boolean;
}

export const AnalysisHistory = ({ onSelectAnalysis, onCompare, comparisonMode = false }: AnalysisHistoryProps) => {
  const [analyses, setAnalyses] = useState<AnalysisResultData[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<AnalysisResultData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const { toast } = useToast();
  const { trackViewHistory, trackExportCSV, trackCompareResumes, trackViewAnalysis } = useAnalytics();

  useEffect(() => {
    fetchAnalyses();
    trackViewHistory();
  }, []);

  useEffect(() => {
    filterAnalyses();
  }, [analyses, riskFilter, searchQuery, dateFilter]);

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
        .order("created_at", { ascending: false });

      if (error) throw error;

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

  const filterAnalyses = () => {
    let filtered = [...analyses];

    // Risk filter
    if (riskFilter !== "all") {
      filtered = filtered.filter(a => a.risk_level === riskFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.resume.file_name.toLowerCase().includes(query) ||
        a.summary?.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (dateFilter) {
        case "today":
          cutoffDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          cutoffDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          cutoffDate = new Date(0);
      }
      
      filtered = filtered.filter(a => new Date(a.created_at) >= cutoffDate);
    }

    setFilteredAnalyses(filtered);
  };

  const handleExportCSV = () => {
    if (filteredAnalyses.length === 0) {
      toast({
        title: "No data to export",
        description: "Apply different filters or add some analyses first.",
        variant: "destructive",
      });
      return;
    }
    exportToCSV(filteredAnalyses, "resume-analyses");
    trackExportCSV(filteredAnalyses.length);
    toast({
      title: "Export complete",
      description: `Exported ${filteredAnalyses.length} analysis result(s) to CSV.`,
    });
  };

  const handleSelectAnalysis = (analysis: AnalysisResultData) => {
    trackViewAnalysis(analysis.id, analysis.risk_level);
    onSelectAnalysis(analysis);
  };

  const toggleCompareSelection = (analysis: AnalysisResultData) => {
    const newSelected = new Set(selectedForCompare);
    
    if (newSelected.has(analysis.id)) {
      newSelected.delete(analysis.id);
    } else {
      if (newSelected.size >= 2) {
        toast({
          title: "Maximum selection reached",
          description: "You can only compare 2 resumes at a time.",
          variant: "destructive",
        });
        return;
      }
      newSelected.add(analysis.id);
    }
    
    setSelectedForCompare(newSelected);
  };

  const handleCompare = () => {
    if (selectedForCompare.size !== 2) {
      toast({
        title: "Select 2 resumes",
        description: "Please select exactly 2 resumes to compare.",
        variant: "destructive",
      });
      return;
    }

    const selectedIds = Array.from(selectedForCompare);
    const analysisA = analyses.find(a => a.id === selectedIds[0]);
    const analysisB = analyses.find(a => a.id === selectedIds[1]);

    if (analysisA && analysisB && onCompare) {
      trackCompareResumes();
      onCompare([analysisA, analysisB]);
      setSelectedForCompare(new Set());
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            Analysis History
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredAnalyses.length} of {analyses.length})
            </span>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {selectedForCompare.size > 0 && onCompare && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCompare}
                disabled={selectedForCompare.size !== 2}
              >
                <GitCompare className="h-4 w-4 mr-1" />
                Compare ({selectedForCompare.size}/2)
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
              <SelectItem value="medium">Medium Risk</SelectItem>
              <SelectItem value="low">Low Risk</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {filteredAnalyses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No results match your filters.</p>
          </div>
        ) : (
          filteredAnalyses.map((analysis) => (
            <div
              key={analysis.id}
              className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {onCompare && (
                <Checkbox
                  checked={selectedForCompare.has(analysis.id)}
                  onCheckedChange={() => toggleCompareSelection(analysis)}
                  className="flex-shrink-0"
                />
              )}
              
              <button
                onClick={() => handleSelectAnalysis(analysis)}
                className="flex-1 flex items-center gap-4 text-left"
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
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
