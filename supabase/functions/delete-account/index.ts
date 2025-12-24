import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    logStep("Authorization header found");

    // Create Supabase client with service role to delete user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid or expired token");
    }
    
    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Delete user data from all tables (RLS will handle most, but we use service role for complete cleanup)
    // Delete analysis results
    const { error: analysisError } = await supabaseAdmin
      .from("analysis_results")
      .delete()
      .eq("user_id", userId);
    if (analysisError) logStep("Error deleting analysis_results", analysisError);

    // Delete resumes
    const { error: resumesError } = await supabaseAdmin
      .from("resumes")
      .delete()
      .eq("user_id", userId);
    if (resumesError) logStep("Error deleting resumes", resumesError);

    // Delete usage logs
    const { error: logsError } = await supabaseAdmin
      .from("usage_logs")
      .delete()
      .eq("user_id", userId);
    if (logsError) logStep("Error deleting usage_logs", logsError);

    // Delete workspace memberships
    const { error: membersError } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("user_id", userId);
    if (membersError) logStep("Error deleting workspace_members", membersError);

    // Delete owned workspaces (this will cascade to shared_analyses)
    const { error: workspacesError } = await supabaseAdmin
      .from("team_workspaces")
      .delete()
      .eq("owner_id", userId);
    if (workspacesError) logStep("Error deleting team_workspaces", workspacesError);

    // Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (rolesError) logStep("Error deleting user_roles", rolesError);

    // Delete profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", userId);
    if (profileError) logStep("Error deleting profile", profileError);

    logStep("User data deleted from tables");

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new Error(`Failed to delete auth user: ${deleteError.message}`);
    }

    logStep("Auth user deleted successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    // Return generic error message to client
    return new Response(JSON.stringify({ error: "Unable to delete account. Please try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});