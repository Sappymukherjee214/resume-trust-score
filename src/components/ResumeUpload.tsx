import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, X } from "lucide-react";

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

interface ResumeUploadProps {
  onAnalysisComplete: (analysis: AnalysisResultData) => void;
  disabled?: boolean;
}

export const ResumeUpload = ({ onAnalysisComplete, disabled }: ResumeUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, [disabled]);

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, or TXT file.",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For TXT files, read directly
    if (file.type === "text/plain") {
      return await file.text();
    }
    
    // For PDF and DOCX, we'll read as text for now
    // In a production app, you'd use a proper parser
    // For MVP, we'll extract basic text content
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(arrayBuffer);
    
    // Clean up the text - remove binary garbage and keep readable content
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    text = text.replace(/\s+/g, " ");
    text = text.trim();
    
    // If we got very little text, it might be a PDF - try different approach
    if (text.length < 100 && file.type === "application/pdf") {
      // Look for text streams in PDF
      const rawText = await file.text();
      const matches = rawText.match(/\(([^)]+)\)/g);
      if (matches) {
        text = matches.map(m => m.slice(1, -1)).join(" ");
      }
    }
    
    return text || "Unable to extract text content from this file format.";
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in to analyze resumes");
      }

      // Extract text from file
      const resumeText = await extractTextFromFile(selectedFile);
      
      if (resumeText.length < 50) {
        toast({
          title: "Unable to read resume",
          description: "Could not extract enough text from this file. Please try a different format.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      // Create resume record
      const { data: resumeData, error: resumeError } = await supabase
        .from("resumes")
        .insert({
          user_id: session.user.id,
          file_name: selectedFile.name,
          extracted_text: resumeText.substring(0, 50000), // Limit text length
          file_size: selectedFile.size,
        })
        .select()
        .single();

      if (resumeError) throw resumeError;

      // Call AI analysis edge function
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-resume",
        {
          body: {
            resumeText: resumeText.substring(0, 30000),
            fileName: selectedFile.name,
          },
        }
      );

      if (analysisError) {
        console.error("Analysis error:", analysisError);
        throw new Error(analysisError.message || "Failed to analyze resume");
      }

      if (analysisData.error) {
        throw new Error(analysisData.error);
      }

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
        metadata: { resume_id: resumeData.id, file_name: selectedFile.name },
      });

      toast({
        title: "Analysis complete!",
        description: `Credibility score: ${analysisData.credibility_score}/100`,
      });

      onAnalysisComplete({
        ...resultData,
        resume: { file_name: selectedFile.name },
      } as unknown as AnalysisResultData);

      setSelectedFile(null);
    } catch (error: any) {
      console.error("Error analyzing resume:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "An error occurred while analyzing the resume.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-border"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50"}
        `}
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-10 w-10 text-primary" />
            <div className="text-left">
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
              disabled={isAnalyzing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">
              Drag and drop your resume here
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse files
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={disabled}
            />
          </>
        )}
      </div>

      {selectedFile && (
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || disabled}
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Resume...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Analyze Resume
            </>
          )}
        </Button>
      )}
    </div>
  );
};
