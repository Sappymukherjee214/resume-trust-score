import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Settings, UserPlus, Crown, Trash2, Share2, Eye, Mail, Clock, Loader2 } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: "admin" | "member" | "viewer";
  joined_at: string | null;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  created_at: string;
  expires_at: string;
}

interface SharedAnalysis {
  id: string;
  analysis_id: string;
  shared_at: string;
  analysis?: {
    id: string;
    credibility_score: number;
    risk_level: string;
    summary: string;
    resume: {
      file_name: string;
    };
  };
}

interface TeamWorkspaceProps {
  userId: string;
  userEmail?: string;
  userName?: string;
}

export const TeamWorkspace = ({ userId, userEmail, userName }: TeamWorkspaceProps) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [sharedAnalyses, setSharedAnalyses] = useState<SharedAnalysis[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const { toast } = useToast();

  const fetchWorkspaces = async () => {
    // Fetch owned workspaces
    const { data: owned } = await supabase
      .from("team_workspaces")
      .select("*")
      .eq("owner_id", userId);

    // Fetch workspaces user is a member of
    const { data: memberOf } = await supabase
      .from("workspace_members")
      .select("workspace:team_workspaces(*)")
      .eq("user_id", userId);

    const memberWorkspaces = memberOf?.map(m => m.workspace).filter(Boolean) as Workspace[] || [];
    const allWorkspaces = [...(owned || []), ...memberWorkspaces];
    
    // Deduplicate by id
    const uniqueWorkspaces = allWorkspaces.filter((w, i, arr) => 
      arr.findIndex(x => x.id === w.id) === i
    );
    
    setWorkspaces(uniqueWorkspaces);
    
    if (uniqueWorkspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(uniqueWorkspaces[0]);
    }
  };

  const fetchWorkspaceDetails = async (workspaceId: string) => {
    // Fetch members
    const { data: membersData } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId);
    
    setMembers((membersData || []) as WorkspaceMember[]);

    // Fetch pending invitations
    const { data: pendingData } = await supabase
      .from("pending_invitations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    setPendingInvitations((pendingData || []) as PendingInvitation[]);

    // Fetch shared analyses
    const { data: sharedData } = await supabase
      .from("shared_analyses")
      .select(`
        id,
        analysis_id,
        shared_at
      `)
      .eq("workspace_id", workspaceId);

    setSharedAnalyses((sharedData || []) as SharedAnalysis[]);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [userId]);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchWorkspaceDetails(selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    const { data, error } = await supabase
      .from("team_workspaces")
      .insert({
        name: newWorkspaceName,
        description: newWorkspaceDescription || null,
        owner_id: userId
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Workspace created",
        description: `${newWorkspaceName} has been created`
      });
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      fetchWorkspaces();
      if (data) setSelectedWorkspace(data);
    }
    setIsCreating(false);
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !selectedWorkspace) return;

    setIsInviting(true);
    
    try {
      // Call the edge function to send invitation
      const { data, error } = await supabase.functions.invoke("send-workspace-invitation", {
        body: {
          email: inviteEmail,
          workspaceId: selectedWorkspace.id,
          workspaceName: selectedWorkspace.name,
          role: inviteRole,
          inviterName: userName || userEmail || "A team member"
        }
      });

      if (error) throw error;

      if (data.type === "existing_user") {
        toast({
          title: "Member added",
          description: `${inviteEmail} has been added to the workspace`
        });
      } else {
        toast({
          title: "Invitation sent",
          description: `An invitation email has been sent to ${inviteEmail}`
        });
      }

      setInviteEmail("");
      fetchWorkspaceDetails(selectedWorkspace.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive"
      });
    }
    
    setIsInviting(false);
  };

  const cancelInvitation = async (invitationId: string) => {
    if (!selectedWorkspace) return;

    const { error } = await supabase
      .from("pending_invitations")
      .delete()
      .eq("id", invitationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled"
      });
      fetchWorkspaceDetails(selectedWorkspace.id);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedWorkspace) return;

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Member removed",
        description: "Member has been removed from the workspace"
      });
      fetchWorkspaceDetails(selectedWorkspace.id);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default";
      case "member": return "secondary";
      case "viewer": return "outline";
      default: return "outline";
    }
  };

  const isOwner = selectedWorkspace?.owner_id === userId;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Workspaces
            </CardTitle>
            <CardDescription>
              Collaborate with your team on resume analyses
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
                <DialogDescription>
                  Create a new team workspace to share analyses
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="e.g., HR Team"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-desc">Description (optional)</Label>
                  <Input
                    id="workspace-desc"
                    placeholder="Brief description"
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={createWorkspace}
                  disabled={isCreating || !newWorkspaceName.trim()}
                >
                  Create Workspace
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {workspaces.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No workspaces yet. Create one to start collaborating!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Workspace selector */}
            <Select
              value={selectedWorkspace?.id}
              onValueChange={(id) => {
                const ws = workspaces.find(w => w.id === id);
                if (ws) setSelectedWorkspace(ws);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <div className="flex items-center gap-2">
                      {ws.owner_id === userId && <Crown className="h-3 w-3 text-primary" />}
                      {ws.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedWorkspace && (
              <Tabs defaultValue="members" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="members">
                    <Users className="h-4 w-4 mr-1" />
                    Members ({members.length + pendingInvitations.length})
                  </TabsTrigger>
                  <TabsTrigger value="shared">
                    <Share2 className="h-4 w-4 mr-1" />
                    Shared ({sharedAnalyses.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="space-y-4">
                  {/* Invite member */}
                  {isOwner && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Email address"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <Select 
                        value={inviteRole} 
                        onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={inviteMember} disabled={isInviting || !inviteEmail.trim()}>
                        {isInviting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Owner */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      <span className="font-medium">Owner</span>
                    </div>
                    <Badge>Owner</Badge>
                  </div>

                  {/* Members list */}
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        {member.role === "admin" && <Settings className="h-4 w-4 text-primary" />}
                        {member.role === "member" && <Users className="h-4 w-4 text-muted-foreground" />}
                        {member.role === "viewer" && <Eye className="h-4 w-4 text-muted-foreground" />}
                        <span>Member</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pending invitations */}
                  {pendingInvitations.length > 0 && (
                    <div className="pt-2">
                      <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pending Invitations
                      </p>
                      {pendingInvitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed border-border mb-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-sm">{invitation.email}</span>
                              <p className="text-xs text-muted-foreground">
                                Expires {new Date(invitation.expires_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-muted-foreground">
                              {invitation.role}
                            </Badge>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelInvitation(invitation.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {members.length === 0 && pendingInvitations.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No members yet. Invite someone to collaborate!
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="shared" className="space-y-4">
                  {sharedAnalyses.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No analyses shared with this workspace yet.
                    </p>
                  ) : (
                    sharedAnalyses.map((shared) => (
                      <div key={shared.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Analysis</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(shared.shared_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
