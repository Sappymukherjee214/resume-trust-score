import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, X, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

interface FileStatus {
  file: File;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  result?: AnalysisResultData;
  error?: string;
}

interface BulkResumeUploadProps {
  onAnalysisComplete: (analysis: AnalysisResultData) => void;
  disabled?: boolean;
  remainingAnalyses: number;
}

export const BulkResumeUpload = ({ onAnalysisComplete, disabled, remainingAnalyses }: BulkResumeUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  }, [disabled]);

  const validateAndAddFiles = (files: File[]) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    
    const validFiles: FileStatus[] = [];
    let invalidCount = 0;
    
    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        invalidCount++;
        continue;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit.`,
          variant: "destructive",
        });
        continue;
      }
      
      // Check if file already added
      if (fileStatuses.some(fs => fs.file.name === file.name && fs.file.size === file.size)) {
        continue;
      }
      
      validFiles.push({ file, status: 'pending' });
    }
    
    if (invalidCount > 0) {
      toast({
        title: "Invalid files skipped",
        description: `${invalidCount} file(s) were skipped. Only PDF, DOCX, and TXT files are supported.`,
        variant: "destructive",
      });
    }
    
    if (validFiles.length > 0) {
      setFileStatuses(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      validateAndAddFiles(files);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFileStatuses(prev => prev.filter((_, i) => i !== index));
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === "text/plain") {
      return await file.text();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(arrayBuffer);
    
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    text = text.replace(/\s+/g, " ");
    text = text.trim();
    
    if (text.length < 100 && file.type === "application/pdf") {
      const rawText = await file.text();
      const matches = rawText.match(/\(([^)]+)\)/g);
      if (matches) {
        text = matches.map(m => m.slice(1, -1)).join(" ");
      }
    }
    
    return text || "Unable to extract text content from this file format.";
  };

  const analyzeFile = async (fileStatus: FileStatus, userEmail: string, userName: string | undefined, session: any): Promise<AnalysisResultData | null> => {
    const resumeText = await extractTextFromFile(fileStatus.file);
    
    if (resumeText.length < 50) {
      throw new Error("Could not extract enough text from this file");
    }

    // Create resume record
    const { data: resumeData, error: resumeError } = await supabase
      .from("resumes")
      .insert({
        user_id: session.user.id,
        file_name: fileStatus.file.name,
        extracted_text: resumeText.substring(0, 50000),
        file_size: fileStatus.file.size,
      })
      .select()
      .single();

    if (resumeError) throw resumeError;

    // Call AI analysis
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
      "analyze-resume",
      {
        body: {
          resumeText: resumeText.substring(0, 30000),
          fileName: fileStatus.file.name,
        },
      }
    );

    if (analysisError) throw new Error(analysisError.message || "Failed to analyze resume");
    if (analysisData.error) throw new Error(analysisData.error);

    // Save analysis result
    const { data: resultData, error: resultError } = await supabase
      .from("analysis_results")
      .insert({
        resume_id: resumeData.id,
        user_id: session.user.id,
        credibility_score: analysisData.credibility_score,
        risk_level: analysisData.risk_level,
        flags: analysisData.flags,
        summary: analysisData.summary,
        detailed_analysis: analysisData.detailed_analysis,
      })
      .select()
      .single();

    if (resultError) throw resultError;

    // Log usage
    await supabase.from("usage_logs").insert({
      user_id: session.user.id,
      action: "resume_analysis",
      metadata: { resume_id: resumeData.id, file_name: fileStatus.file.name },
    });

    // Send email notification for high-risk resumes
    if (analysisData.risk_level === 'high') {
      try {
        await supabase.functions.invoke("send-risk-notification", {
          body: {
            userEmail,
            userName,
            fileName: fileStatus.file.name,
            riskLevel: analysisData.risk_level,
            credibilityScore: analysisData.credibility_score,
            summary: analysisData.summary,
            flagCount: analysisData.flags?.length || 0,
          },
        });
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
      }
    }

    return {
      ...resultData,
      resume: { file_name: fileStatus.file.name },
    } as unknown as AnalysisResultData;
  };

  const handleAnalyzeAll = async () => {
    const pendingFiles = fileStatuses.filter(fs => fs.status === 'pending');
    
    if (pendingFiles.length === 0) return;
    
    if (pendingFiles.length > remainingAnalyses) {
      toast({
        title: "Not enough analyses",
        description: `You have ${remainingAnalyses} analyses remaining but selected ${pendingFiles.length} files.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in to analyze resumes");
      }

      // Get user profile for email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", session.user.id)
        .single();

      const userEmail = profile?.email || session.user.email || '';
      const userName = profile?.full_name;

      // Process files sequentially to avoid rate limits
      for (let i = 0; i < fileStatuses.length; i++) {
        const fs = fileStatuses[i];
        if (fs.status !== 'pending') continue;

        // Update status to analyzing
        setFileStatuses(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'analyzing' as const } : item
        ));

        try {
          const result = await analyzeFile(fs, userEmail, userName, session);
          
          setFileStatuses(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'complete' as const, result: result || undefined } : item
          ));

          if (result) {
            onAnalysisComplete(result);
          }
        } catch (error: any) {
          console.error(`Error analyzing ${fs.file.name}:`, error);
          setFileStatuses(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'error' as const, error: error.message } : item
          ));
        }

        // Small delay between files to avoid rate limiting
        if (i < fileStatuses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const completedCount = fileStatuses.filter(fs => fs.status === 'complete').length + 
        fileStatuses.filter(fs => fs.status === 'pending').length;
      
      toast({
        title: "Bulk analysis complete",
        description: `Processed ${pendingFiles.length} resume(s).`,
      });

    } catch (error: any) {
      console.error("Error in bulk analysis:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "An error occurred during bulk analysis.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setFileStatuses([]);
  };

  const pendingCount = fileStatuses.filter(fs => fs.status === 'pending').length;
  const analyzingCount = fileStatuses.filter(fs => fs.status === 'analyzing').length;
  const completeCount = fileStatuses.filter(fs => fs.status === 'complete').length;
  const errorCount = fileStatuses.filter(fs => fs.status === 'error').length;
  const progressPercent = fileStatuses.length > 0 
    ? ((completeCount + errorCount) / fileStatuses.length) * 100 
    : 0;

  const getStatusIcon = (status: FileStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'analyzing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-border"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50"}
        `}
      >
        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-foreground font-medium mb-1">
          Drag and drop multiple resumes here
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse files (PDF, DOCX, TXT)
        </p>
        <input
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || isProcessing}
          multiple
        />
      </div>

      {fileStatuses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {fileStatuses.length} file(s) selected
              {pendingCount > 0 && ` • ${pendingCount} pending`}
              {analyzingCount > 0 && ` • ${analyzingCount} analyzing`}
              {completeCount > 0 && ` • ${completeCount} complete`}
              {errorCount > 0 && ` • ${errorCount} failed`}
            </p>
            {!isProcessing && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>

          {isProcessing && (
            <Progress value={progressPercent} className="h-2" />
          )}

          <div className="max-h-48 overflow-y-auto space-y-2">
            {fileStatuses.map((fs, index) => (
              <div
                key={`${fs.file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                {getStatusIcon(fs.status)}
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fs.file.name}</p>
                  {fs.status === 'complete' && fs.result && (
                    <p className="text-xs text-muted-foreground">
                      Score: {fs.result.credibility_score}/100 • {fs.result.risk_level} risk
                    </p>
                  )}
                  {fs.status === 'error' && (
                    <p className="text-xs text-destructive">{fs.error}</p>
                  )}
                </div>
                {fs.status === 'pending' && !isProcessing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {pendingCount > 0 && (
            <Button
              onClick={handleAnalyzeAll}
              disabled={isProcessing || disabled || pendingCount > remainingAnalyses}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing {analyzingCount > 0 ? `(${completeCount + 1}/${fileStatuses.length})` : '...'}
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Analyze {pendingCount} Resume{pendingCount > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
