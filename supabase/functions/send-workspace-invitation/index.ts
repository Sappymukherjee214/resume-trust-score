import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  inviterName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send workspace invitation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, workspaceId, workspaceName, role, inviterName }: InvitationRequest = await req.json();
    
    console.log(`Sending invitation to ${email} for workspace ${workspaceName}`);

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      // User exists, add them directly as a member
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: existingProfile.user_id,
          role: role,
          joined_at: new Date().toISOString()
        });

      if (memberError && memberError.code !== "23505") {
        throw memberError;
      }

      // Still send an email notification
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "ResumeVerify <onboarding@resend.dev>",
          to: [email],
          subject: `You've been added to ${workspaceName} on ResumeVerify`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #7c3aed;">Welcome to ${workspaceName}!</h1>
              <p style="color: #374151; font-size: 16px;">
                ${inviterName} has added you to the <strong>${workspaceName}</strong> workspace on ResumeVerify as a <strong>${role}</strong>.
              </p>
              <p style="color: #374151; font-size: 16px;">
                You can now collaborate on resume analyses with your team.
              </p>
              <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/dashboard" 
                 style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                Go to Dashboard
              </a>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Best regards,<br>The ResumeVerify Team
              </p>
            </div>
          `,
        }),
      });

      const emailData = await emailResponse.json();
      console.log("Notification email sent:", emailData);

      return new Response(
        JSON.stringify({ success: true, type: "existing_user", emailResponse }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // User doesn't exist, create pending invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("pending_invitations")
      .insert({
        workspace_id: workspaceId,
        email: email,
        role: role,
        invited_by: user.id
      })
      .select()
      .single();

    if (inviteError) {
      if (inviteError.code === "23505") {
        throw new Error("This email has already been invited to this workspace");
      }
      throw inviteError;
    }

    // Send invitation email
    const signupUrl = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/auth?mode=signup&invitation=${invitation.token}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ResumeVerify <onboarding@resend.dev>",
        to: [email],
        subject: `You're invited to join ${workspaceName} on ResumeVerify`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #7c3aed;">You're Invited!</h1>
            <p style="color: #374151; font-size: 16px;">
              ${inviterName} has invited you to join the <strong>${workspaceName}</strong> workspace on ResumeVerify as a <strong>${role}</strong>.
            </p>
            <p style="color: #374151; font-size: 16px;">
              ResumeVerify uses AI to analyze resumes and detect potential red flags, helping teams make better hiring decisions.
            </p>
            <a href="${signupUrl}" 
               style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
              Accept Invitation & Sign Up
            </a>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This invitation expires in 7 days.
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              Best regards,<br>The ResumeVerify Team
            </p>
          </div>
        `,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Invitation email sent:", emailData);

    return new Response(
      JSON.stringify({ success: true, type: "new_user", emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-workspace-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
