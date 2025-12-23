import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeText, fileName } = await req.json();
    
    if (!resumeText || resumeText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Resume text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing resume:', fileName);
    console.log('Resume text length:', resumeText.length);

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
          { role: 'user', content: `Please analyze this resume and provide your assessment:\n\n${resumeText}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);

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
      console.error('Error parsing AI response:', parseError);
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
    console.error('Error in analyze-resume function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
