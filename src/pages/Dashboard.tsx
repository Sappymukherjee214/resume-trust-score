import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Upload, History, LogOut, FileText, CheckCircle, TrendingUp, Settings, Files, Users } from "lucide-react";
import { ResumeUpload } from "@/components/ResumeUpload";
import { BulkResumeUpload } from "@/components/BulkResumeUpload";
import { AnalysisHistory } from "@/components/AnalysisHistory";
import { AnalysisResult } from "@/components/AnalysisResult";
import { ComparisonView } from "@/components/ComparisonView";
import { TeamWorkspace } from "@/components/TeamWorkspace";
import { RiskTrendChart } from "@/components/RiskTrendChart";
import neuralBg from "@/assets/neural-network-bg.png";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

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

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResultData | null>(null);
  const [comparisonAnalyses, setComparisonAnalyses] = useState<[AnalysisResultData, AnalysisResultData] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      setProfile(data as Profile);
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!roles);
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
    navigate("/");
  };

  const handleAnalysisComplete = (analysis: AnalysisResultData) => {
    setCurrentAnalysis(analysis);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background image */}
      <div 
        className="fixed inset-0 z-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url(${neuralBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">ResumeVerify</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {profile?.email}
              </span>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Free
              </Badge>
            </div>
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="text-2xl font-bold text-foreground">
                  Free - Unlimited
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold text-foreground">
                  Active
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk Trend Chart */}
        {user && (
          <div className="mb-8">
            <RiskTrendChart userId={user.id} />
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Single</span> Upload
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Files className="h-4 w-4" />
              Bulk
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Resume for Analysis</CardTitle>
                    <CardDescription>
                      Upload a resume to analyze for potential red flags and inconsistencies.
                      Supported formats: PDF, DOCX, TXT
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResumeUpload 
                      onAnalysisComplete={handleAnalysisComplete}
                      disabled={false}
                    />
                  </CardContent>
                </Card>
              </div>

              <div>
                {currentAnalysis ? (
                  <AnalysisResult analysis={currentAnalysis} />
                ) : (
                  <Card className="h-full">
                    <CardContent className="flex items-center justify-center h-full min-h-[400px] text-center">
                      <div className="space-y-4">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-foreground">No Analysis Yet</h3>
                          <p className="text-sm text-muted-foreground">
                            Upload a resume to see the AI analysis results here.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Files className="h-5 w-5" />
                      Bulk Resume Upload
                    </CardTitle>
                    <CardDescription>
                      Upload multiple resumes at once for batch analysis.
                      High-risk resumes will trigger email notifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BulkResumeUpload 
                      onAnalysisComplete={handleAnalysisComplete}
                      disabled={false}
                      remainingAnalyses={9999}
                    />
                  </CardContent>
                </Card>
              </div>

              <div>
                {currentAnalysis ? (
                  <AnalysisResult analysis={currentAnalysis} />
                ) : (
                  <Card className="h-full">
                    <CardContent className="flex items-center justify-center h-full min-h-[400px] text-center">
                      <div className="space-y-4">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <Files className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-foreground">No Analysis Yet</h3>
                          <p className="text-sm text-muted-foreground">
                            Upload resumes to see the AI analysis results here.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {comparisonAnalyses ? (
              <ComparisonView 
                analysisA={comparisonAnalyses[0]}
                analysisB={comparisonAnalyses[1]}
                onClose={() => setComparisonAnalyses(null)}
                onRemove={(which) => setComparisonAnalyses(null)}
              />
            ) : (
              <AnalysisHistory 
                onSelectAnalysis={setCurrentAnalysis}
                onCompare={(analyses) => setComparisonAnalyses(analyses)}
              />
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <TeamWorkspace userId={user.id} userEmail={user.email || ''} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
