import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generic error messages to avoid information leakage
const ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid or insufficient resume content provided',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  CREDITS_DEPLETED: 'Service temporarily unavailable. Please try again later.',
  PROCESSING_FAILED: 'Unable to process resume. Please try again.',
  UNAUTHORIZED: 'Authentication required',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ANALYZE-RESUME] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('ERROR', 'Missing authorization header');
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      logStep('ERROR', 'Invalid or expired authentication token');
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Authenticated user', { userId: user.id });

    const { resumeText, fileName } = await req.json();
    
    // Enhanced input validation
    if (!resumeText || typeof resumeText !== 'string') {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_INPUT }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedText = resumeText.trim();
    
    // Validate minimum content length
    if (trimmedText.length < 50) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_INPUT }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that content contains readable text (at least some alphabetic characters)
    if (!/[a-zA-Z]{10,}/.test(trimmedText)) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_INPUT }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit maximum text length to prevent abuse
    const maxLength = 50000;
    const processedText = trimmedText.length > maxLength ? trimmedText.substring(0, maxLength) : trimmedText;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      logStep('ERROR', 'LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Analyzing resume', { fileName, textLength: processedText.length });

    const systemPrompt = `You are an expert hiring analyst and resume verification specialist. Your task is to analyze resumes for potential red flags, inconsistencies, and signs of fabrication or exaggeration.

Analyze the provided resume critically and look for:
1. Unrealistic skill combinations (e.g., claiming expertise in too many unrelated technologies)
2. Inflated or vague job titles that don't match described responsibilities
3. Inconsistent experience timelines (gaps, overlaps, or unrealistic career progression)
4. Generic or copied job descriptions that lack specificity
5. Mismatches between education, skills, and claimed work experience
6. Buzzword stuffing without substantive details
7. Impossible achievements or metrics (e.g., "increased revenue by 1000%")
8. Grammatical inconsistencies suggesting copied content
9. Missing or vague company information
10. Skills or certifications that don't align with experience level

You MUST respond with valid JSON in exactly this format:
{
  "credibility_score": <number between 0-100>,
  "risk_level": "<low|medium|high>",
  "summary": "<2-3 sentence summary of findings>",
  "flags": [
    {
      "category": "<category name>",
      "severity": "<low|medium|high>",
      "description": "<specific finding>"
    }
  ],
  "detailed_analysis": {
    "experience_consistency": "<assessment>",
    "skills_alignment": "<assessment>",
    "achievements_credibility": "<assessment>",
    "overall_authenticity": "<assessment>"
  }
}

Scoring guidelines:
- 80-100: Low risk - Resume appears genuine with minor or no concerns
- 50-79: Medium risk - Some inconsistencies or red flags worth investigating
- 0-49: High risk - Multiple serious red flags suggesting potential fabrication

Be thorough but fair. Not every unusual element indicates fraud.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyze this resume and provide your assessment:\n\n${processedText}` }
        ],
      }),
    });

    if (!response.ok) {
      logStep('AI Gateway error', { status: response.status });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.RATE_LIMITED }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.CREDITS_DEPLETED }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    logStep('AI response received');

    // Parse the JSON response from AI
    let analysisResult;
    try {
      // Extract JSON from the response (in case it's wrapped in markdown code blocks)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logStep('Parse error, using fallback analysis');
      // Return a default analysis if parsing fails
      analysisResult = {
        credibility_score: 50,
        risk_level: 'medium',
        summary: 'Unable to fully analyze the resume. The content may be incomplete or in an unusual format.',
        flags: [
          {
            category: 'Analysis',
            severity: 'low',
            description: 'Resume format made full analysis difficult'
          }
        ],
        detailed_analysis: {
          experience_consistency: 'Unable to assess',
          skills_alignment: 'Unable to assess',
          achievements_credibility: 'Unable to assess',
          overall_authenticity: 'Requires manual review'
        }
      };
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('ERROR', { message: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(
      JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
