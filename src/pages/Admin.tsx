import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Search,
  Filter,
  Loader2,
  BarChart3,
  TrendingUp,
  Activity
} from "lucide-react";

interface AnalysisWithDetails {
  id: string;
  credibility_score: number;
  risk_level: string;
  summary: string;
  created_at: string;
  resumes: {
    file_name: string;
    user_id: string;
  };
  profiles?: {
    email: string;
    full_name: string;
  };
}

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface UsageLog {
  id: string;
  user_id: string;
  action: string;
  metadata: any;
  created_at: string;
}

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [analyses, setAnalyses] = useState<AnalysisWithDetails[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [actionCounts, setActionCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({
    totalResumes: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    totalUsers: 0,
    totalActions: 0
  });
  
  // Filter states
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setSession(session);
    setUser(session.user);

    // Check if user is admin
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error || !roles) {
      setIsAdmin(false);
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    setIsLoading(false);
    fetchData();
  };

  const fetchData = async () => {
    try {
      // Fetch all analyses with resume and user details
      const { data: analysesData, error: analysesError } = await supabase
        .from("analysis_results")
        .select(`
          id,
          credibility_score,
          risk_level,
          summary,
          created_at,
          resumes (
            file_name,
            user_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (analysesError) throw analysesError;

      // Fetch all users/profiles
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Fetch usage logs
      const { data: logsData, error: logsError } = await supabase
        .from("usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      setUsageLogs(logsData || []);

      // Count actions
      const counts: Record<string, number> = {};
      (logsData || []).forEach((log: UsageLog) => {
        counts[log.action] = (counts[log.action] || 0) + 1;
      });
      setActionCounts(counts);

      // Create a map of user_id to profile
      const userMap = new Map();
      (usersData || []).forEach((profile: UserProfile) => {
        userMap.set(profile.user_id, profile);
      });

      // Attach profile info to analyses
      const analysesWithProfiles = (analysesData || []).map((analysis: any) => ({
        ...analysis,
        profiles: userMap.get(analysis.resumes?.user_id) || null
      }));

      setAnalyses(analysesWithProfiles);
      setUsers(usersData || []);

      // Calculate stats
      const highRisk = analysesWithProfiles.filter((a: AnalysisWithDetails) => a.risk_level === "high").length;
      const mediumRisk = analysesWithProfiles.filter((a: AnalysisWithDetails) => a.risk_level === "medium").length;
      const lowRisk = analysesWithProfiles.filter((a: AnalysisWithDetails) => a.risk_level === "low").length;

      setStats({
        totalResumes: analysesWithProfiles.length,
        highRisk,
        mediumRisk,
        lowRisk,
        totalUsers: usersData?.length || 0,
        totalActions: logsData?.length || 0
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data.",
        variant: "destructive",
      });
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
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Filter analyses
  const filteredAnalyses = analyses.filter(analysis => {
    const matchesRisk = riskFilter === "all" || analysis.risk_level === riskFilter;
    const matchesSearch = searchQuery === "" || 
      analysis.resumes?.file_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      analysis.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  // Filter users
  const filteredUsers = users.filter(user => {
    return userSearchQuery === "" ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase());
  });

  if (isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">Admin Dashboard</span>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Administrator
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.totalResumes}</p>
              <p className="text-xs text-muted-foreground">Total Analyses</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.highRisk}</p>
              <p className="text-xs text-muted-foreground">High Risk</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.mediumRisk}</p>
              <p className="text-xs text-muted-foreground">Medium Risk</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.lowRisk}</p>
              <p className="text-xs text-muted-foreground">Low Risk</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="analyses" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analyses" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Analyses
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Analyses Tab */}
          <TabsContent value="analyses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Resume Analyses</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by filename or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full sm:w-64"
                      />
                    </div>
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by risk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Risks</SelectItem>
                        <SelectItem value="high">High Risk</SelectItem>
                        <SelectItem value="medium">Medium Risk</SelectItem>
                        <SelectItem value="low">Low Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAnalyses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No analyses found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAnalyses.map((analysis) => (
                          <TableRow key={analysis.id}>
                            <TableCell className="font-medium">
                              {analysis.resumes?.file_name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{analysis.profiles?.email || "Unknown"}</p>
                                {analysis.profiles?.full_name && (
                                  <p className="text-xs text-muted-foreground">{analysis.profiles.full_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`font-bold ${getScoreColor(analysis.credibility_score)}`}>
                                {analysis.credibility_score}/100
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getRiskBadgeStyles(analysis.risk_level)} capitalize`}>
                                {analysis.risk_level}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(analysis.created_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredAnalyses.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Showing {filteredAnalyses.length} of {analyses.length} analyses
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>User Accounts</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>{user.full_name || "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(user.created_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredUsers.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Showing {filteredUsers.length} of {users.length} users
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">{stats.totalActions}</p>
                  <p className="text-xs text-muted-foreground">Total Actions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">{actionCounts["resume_upload"] || actionCounts["resume_analysis"] || 0}</p>
                  <p className="text-xs text-muted-foreground">Resume Uploads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">{actionCounts["view_history"] || 0}</p>
                  <p className="text-xs text-muted-foreground">History Views</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">{actionCounts["export_csv"] || 0}</p>
                  <p className="text-xs text-muted-foreground">CSV Exports</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Feature Usage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(actionCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground capitalize">
                            {action.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ 
                                width: `${Math.min((count / Math.max(...Object.values(actionCounts))) * 100, 100)}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold text-foreground w-12 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                  {Object.keys(actionCounts).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No usage data available yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No activity logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        usageLogs.slice(0, 20).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium capitalize">
                              {log.action.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.user_id.substring(0, 8)}...
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(log.created_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
