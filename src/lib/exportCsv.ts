interface AnalysisResultData {
  id: string;
  credibility_score: number;
  risk_level: string;
  flags: Array<{ category: string; severity: string; description: string }>;
  summary: string;
  detailed_analysis: {
    experience_consistency: string;
    skills_alignment: string;
    achievements_credibility: string;
    overall_authenticity: string;
  };
  created_at: string;
  resume: {
    file_name: string;
  };
}

export const exportToCSV = (analyses: AnalysisResultData[], fileName: string = 'resume-analyses') => {
  const headers = [
    'File Name',
    'Credibility Score',
    'Risk Level',
    'Summary',
    'Flag Count',
    'Flags',
    'Experience Consistency',
    'Skills Alignment',
    'Achievements Credibility',
    'Overall Authenticity',
    'Analysis Date',
  ];

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, newline, or quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = analyses.map((analysis) => {
    const flagsText = analysis.flags
      ?.map((f) => `[${f.severity}] ${f.category}: ${f.description}`)
      .join('; ') || '';

    return [
      escapeCSV(analysis.resume.file_name),
      analysis.credibility_score,
      analysis.risk_level,
      escapeCSV(analysis.summary),
      analysis.flags?.length || 0,
      escapeCSV(flagsText),
      escapeCSV(analysis.detailed_analysis?.experience_consistency),
      escapeCSV(analysis.detailed_analysis?.skills_alignment),
      escapeCSV(analysis.detailed_analysis?.achievements_credibility),
      escapeCSV(analysis.detailed_analysis?.overall_authenticity),
      new Date(analysis.created_at).toLocaleString(),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
