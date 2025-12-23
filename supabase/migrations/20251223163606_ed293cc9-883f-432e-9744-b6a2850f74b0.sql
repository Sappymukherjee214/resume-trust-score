-- Create pending_invitations table for users who haven't registered yet
CREATE TABLE public.pending_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(workspace_id, email)
);

-- Enable RLS
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Workspace admins can manage invitations"
ON public.pending_invitations
FOR ALL
USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Users can view invitations sent to their email"
ON public.pending_invitations
FOR SELECT
USING (
  email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can accept invitations sent to their email"
ON public.pending_invitations
FOR UPDATE
USING (
  email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);