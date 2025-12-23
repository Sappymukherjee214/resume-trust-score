import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Upload, History, LogOut, FileText, AlertTriangle, CheckCircle, TrendingUp, Crown, Loader2 } from "lucide-react";
import { ResumeUpload } from "@/components/ResumeUpload";
import { AnalysisHistory } from "@/components/AnalysisHistory";
import { AnalysisResult } from "@/components/AnalysisResult";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  subscription_plan: string;
  monthly_analysis_count: number;
  monthly_analysis_limit: number;
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
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      // Check subscription status and update profile
      checkSubscription();
      setProfile(data as Profile);
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (!error && data) {
        // Refresh profile after subscription check
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user?.id || session?.user?.id)
          .maybeSingle();
        
        if (profileData) {
          setProfile(profileData as Profile);
        }
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }, [user, session]);

  // Check for checkout success
  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success") {
      toast({
        title: "Subscription activated!",
        description: "Your Pro plan is now active. You have 100 analyses per month.",
      });
      checkSubscription();
    } else if (checkoutStatus === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "You can upgrade anytime from the pricing page.",
      });
    }
  }, [searchParams, toast, checkSubscription]);

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

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleAnalysisComplete = (analysis: AnalysisResultData) => {
    setCurrentAnalysis(analysis);
    // Refresh profile to update count
    if (user) {
      fetchProfile(user.id);
    }
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

  const remainingAnalyses = profile 
    ? profile.monthly_analysis_limit - profile.monthly_analysis_count 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
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
              {profile?.subscription_plan === "pro" ? (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Crown className="h-3 w-3 mr-1" />
                  Pro
                </Badge>
              ) : (
                <Link to="/pricing">
                  <Button size="sm" variant="outline">
                    <Crown className="h-3 w-3 mr-1" />
                    Upgrade
                  </Button>
                </Link>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Analyses Used</p>
                <p className="text-2xl font-bold text-foreground">
                  {profile?.monthly_analysis_count || 0} / {profile?.monthly_analysis_limit || 5}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-foreground">
                  {remainingAnalyses} analyses
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                {remainingAnalyses > 0 ? (
                  <CheckCircle className="h-6 w-6 text-secondary-foreground" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold text-foreground">
                  {remainingAnalyses > 0 ? "Active" : "Limit Reached"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Resume
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
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
                      disabled={remainingAnalyses <= 0}
                    />
                    {remainingAnalyses <= 0 && (
                      <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm text-destructive">
                          You've reached your monthly limit. Upgrade to Pro for more analyses.
                        </p>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="mt-2"
                          onClick={handleUpgrade}
                          disabled={isUpgrading}
                        >
                          {isUpgrading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Crown className="mr-2 h-4 w-4" />
                              Upgrade to Pro
                            </>
                          )}
                        </Button>
                      </div>
                    )}
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

          <TabsContent value="history">
            <AnalysisHistory onSelectAnalysis={setCurrentAnalysis} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
