-- Create team_workspaces table
CREATE TABLE public.team_workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workspace_members table with roles
CREATE TYPE public.workspace_role AS ENUM ('admin', 'member', 'viewer');

CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(workspace_id, user_id)
);

-- Create shared_analyses table for sharing analyses with workspaces
CREATE TABLE public.shared_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(analysis_id, workspace_id)
);

-- Enable RLS
ALTER TABLE public.team_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_analyses ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
  )
$$;

-- Create function to check workspace admin role
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role = 'admin'
  ) OR EXISTS (
    SELECT 1
    FROM public.team_workspaces
    WHERE id = _workspace_id
      AND owner_id = _user_id
  )
$$;

-- team_workspaces policies
CREATE POLICY "Owners can manage their workspaces"
ON public.team_workspaces
FOR ALL
USING (auth.uid() = owner_id);

CREATE POLICY "Members can view workspaces"
ON public.team_workspaces
FOR SELECT
USING (public.is_workspace_member(id, auth.uid()));

-- workspace_members policies
CREATE POLICY "Workspace admins can manage members"
ON public.workspace_members
FOR ALL
USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Members can view other members"
ON public.workspace_members
FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- shared_analyses policies
CREATE POLICY "Workspace members can view shared analyses"
ON public.shared_analyses
FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins and original owners can share analyses"
ON public.shared_analyses
FOR INSERT
WITH CHECK (
  public.is_workspace_admin(workspace_id, auth.uid()) OR auth.uid() = shared_by
);

CREATE POLICY "Admins can delete shared analyses"
ON public.shared_analyses
FOR DELETE
USING (public.is_workspace_admin(workspace_id, auth.uid()));

-- Update timestamp trigger for workspaces
CREATE TRIGGER update_team_workspaces_updated_at
  BEFORE UPDATE ON public.team_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();