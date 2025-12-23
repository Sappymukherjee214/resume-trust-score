import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskNotificationRequest {
  userEmail: string;
  userName?: string;
  fileName: string;
  riskLevel: string;
  credibilityScore: number;
  summary: string;
  flagCount: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, fileName, riskLevel, credibilityScore, summary, flagCount }: RiskNotificationRequest = await req.json();

    console.log(`Sending high-risk notification to ${userEmail} for resume: ${fileName}`);

    const riskColor = riskLevel === 'high' ? '#dc2626' : riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
    
    const emailResponse = await resend.emails.send({
      from: "Resume Analyzer <onboarding@resend.dev>",
      to: [userEmail],
      subject: `⚠️ High Risk Resume Alert: ${fileName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Resume Analysis Alert</h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Hello ${userName || 'there'},</p>
            
            <p>A resume you recently analyzed has been flagged with a <strong style="color: ${riskColor};">${riskLevel.toUpperCase()} RISK</strong> level:</p>
            
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">File Name:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${fileName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Credibility Score:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: ${riskColor};">${credibilityScore}/100</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Red Flags Found:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${flagCount}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-weight: 600; color: #92400e;">Summary:</p>
              <p style="margin: 10px 0 0 0; color: #78350f;">${summary}</p>
            </div>
            
            <p>We recommend conducting additional verification checks before proceeding with this candidate.</p>
            
            <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">— The Resume Analyzer Team</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-risk-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
