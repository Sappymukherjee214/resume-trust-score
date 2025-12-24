import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsAction = 
  | "resume_upload"
  | "bulk_upload"
  | "view_history"
  | "view_analysis"
  | "compare_resumes"
  | "export_csv"
  | "create_workspace"
  | "invite_member"
  | "share_analysis"
  | "profile_update"
  | "page_view";

interface AnalyticsMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export const useAnalytics = () => {
  const trackEvent = useCallback(async (
    action: AnalyticsAction,
    metadata?: AnalyticsMetadata
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("Analytics: User not authenticated, skipping event");
        return;
      }

      const { error } = await supabase
        .from("usage_logs")
        .insert({
          user_id: user.id,
          action,
          metadata: metadata || null
        });

      if (error) {
        console.error("Analytics tracking error:", error);
      }
    } catch (error) {
      console.error("Analytics tracking error:", error);
    }
  }, []);

  const trackPageView = useCallback((pageName: string) => {
    trackEvent("page_view", { page: pageName });
  }, [trackEvent]);

  const trackResumeUpload = useCallback((fileName: string, fileSize?: number) => {
    trackEvent("resume_upload", { file_name: fileName, file_size: fileSize });
  }, [trackEvent]);

  const trackBulkUpload = useCallback((fileCount: number) => {
    trackEvent("bulk_upload", { file_count: fileCount });
  }, [trackEvent]);

  const trackViewHistory = useCallback(() => {
    trackEvent("view_history");
  }, [trackEvent]);

  const trackViewAnalysis = useCallback((analysisId: string, riskLevel: string) => {
    trackEvent("view_analysis", { analysis_id: analysisId, risk_level: riskLevel });
  }, [trackEvent]);

  const trackCompareResumes = useCallback(() => {
    trackEvent("compare_resumes");
  }, [trackEvent]);

  const trackExportCSV = useCallback((count: number) => {
    trackEvent("export_csv", { export_count: count });
  }, [trackEvent]);

  const trackCreateWorkspace = useCallback((workspaceName: string) => {
    trackEvent("create_workspace", { workspace_name: workspaceName });
  }, [trackEvent]);

  const trackInviteMember = useCallback((workspaceId: string) => {
    trackEvent("invite_member", { workspace_id: workspaceId });
  }, [trackEvent]);

  const trackShareAnalysis = useCallback((analysisId: string, workspaceId: string) => {
    trackEvent("share_analysis", { analysis_id: analysisId, workspace_id: workspaceId });
  }, [trackEvent]);

  const trackProfileUpdate = useCallback((fields: string[]) => {
    trackEvent("profile_update", { updated_fields: fields.join(",") });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    trackResumeUpload,
    trackBulkUpload,
    trackViewHistory,
    trackViewAnalysis,
    trackCompareResumes,
    trackExportCSV,
    trackCreateWorkspace,
    trackInviteMember,
    trackShareAnalysis,
    trackProfileUpdate
  };
};
