import type { RecommendationReport, AnalysisStep, Journal, JournalRecommendation } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const analysisSteps: AnalysisStep[] = [
  { id: 'upload', label: 'Uploading Document', status: 'pending', description: 'Uploading your manuscript file' },
  { id: 'parse', label: 'Parsing Content', status: 'pending', description: 'Extracting title and abstract' },
  { id: 'keywords', label: 'Identifying Keywords', status: 'pending', description: 'Analyzing research focus areas' },
  { id: 'matching', label: 'Matching Journals', status: 'pending', description: 'Comparing with journal scopes' },
  { id: 'scoring', label: 'Calculating Scores', status: 'pending', description: 'Ranking recommendations' },
  { id: 'report', label: 'Generating Report', status: 'pending', description: 'Preparing final recommendations' }
];

// Session ID for tracking
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export interface JournalFilters {
  quartile?: string[];
  areas?: string[];
  openAccess?: boolean;
  minSjr?: number;
  maxSjr?: number;
  minHIndex?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

// Filters applied during recommendation generation (server-side)
export interface RecommendationFilters {
  sjrQuartile?: string[];
  sjrScore?: { min: number; max: number };
  hIndex?: { min: number; max: number };
  citationsPerDoc?: { min: number; max: number };
  openAccess?: boolean;
  publishers?: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Generate journal website URL using ISSN portal (works for all publishers)
function getJournalWebsiteUrl(issns: string[] | undefined, title: string): string {
  // Use ISSN portal if ISSN is available - this is publisher-agnostic
  if (issns && issns.length > 0) {
    // Clean the ISSN (remove any spaces) and use the first one
    const cleanIssn = issns[0].replace(/\s/g, '');
    return `https://portal.issn.org/resource/ISSN/${cleanIssn}`;
  }
  // Fallback to Google Scholar search by journal title
  return `https://scholar.google.com/scholar?q="${encodeURIComponent(title)}"`;
}

// Transform backend journal to frontend format
function transformJournal(backendJournal: any): Journal {
  // Parse numeric values (PostgreSQL returns DECIMAL as strings)
  const sjrScore = parseFloat(backendJournal.sjr) || 0;
  const hIndex = parseInt(backendJournal.h_index) || 0;
  const citationsPerDoc = parseFloat(backendJournal.citations_per_doc) || 0;

  return {
    id: backendJournal.id || backendJournal.source_id,
    name: backendJournal.title,
    abbreviation: backendJournal.title.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 5),
    publisher: backendJournal.publisher || 'Unknown Publisher',
    scope: backendJournal.scope_text || backendJournal.scope || '',
    subjects: backendJournal.areas || [],
    openAccess: backendJournal.open_access || false,
    reviewTime: '6-8 weeks',
    acceptanceRate: 25 + Math.floor(Math.random() * 30),
    website: getJournalWebsiteUrl(backendJournal.issns, backendJournal.title),
    language: 'English',
    frequency: 'Monthly',
    indexedIn: ['Scimago'],  // Data source: Scimago Journal Rankings
    metrics: {
      sjrQuartile: backendJournal.sjr_quartile || 'N/A',
      sjrScore: sjrScore,
      hIndex: hIndex,
      citationsPerDoc: citationsPerDoc
    }
  };
}

// Transform backend recommendation to frontend format
function transformRecommendation(backendRec: any): JournalRecommendation {
  const journal = transformJournal(backendRec.journal);
  return {
    journal,
    matchScore: backendRec.matchScore || backendRec.match_score,
    matchReasons: [backendRec.matchReason || backendRec.match_reason || 'Good scope alignment'],
    scopeAlignment: backendRec.matchReason || backendRec.match_reason || 'Your research aligns with this journal\'s scope',
    strengthsForJournal: backendRec.pros || [],
    potentialChallenges: backendRec.cons || []
  };
}

export async function uploadAndAnalyze(
  file: File,
  onProgress: (step: number, steps: AnalysisStep[]) => void,
  filters?: RecommendationFilters
): Promise<RecommendationReport> {
  const steps = [...analysisSteps];

  // Step 1: Upload
  steps[0].status = 'active';
  onProgress(0, steps);

  const formData = new FormData();
  formData.append('manuscript', file);
  if (filters) {
    formData.append('filters', JSON.stringify(filters));
  }

  try {
    // Start upload
    steps[0].status = 'complete';
    steps[1].status = 'active';
    onProgress(1, steps);

    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'x-session-id': sessionId
      },
      body: formData
    });

    // Simulate progress steps while waiting for response
    await new Promise(resolve => setTimeout(resolve, 500));
    steps[1].status = 'complete';
    steps[2].status = 'active';
    onProgress(2, steps);

    await new Promise(resolve => setTimeout(resolve, 500));
    steps[2].status = 'complete';
    steps[3].status = 'active';
    onProgress(3, steps);

    await new Promise(resolve => setTimeout(resolve, 500));
    steps[3].status = 'complete';
    steps[4].status = 'active';
    onProgress(4, steps);

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }

    steps[4].status = 'complete';
    steps[5].status = 'active';
    onProgress(5, steps);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Transform the response
    const report: RecommendationReport = {
      id: result.data.id,
      manuscript: {
        id: result.data.manuscript.id,
        title: result.data.manuscript.title,
        abstract: result.data.manuscript.abstract,
        fileName: result.data.manuscript.fileName,
        fileType: result.data.manuscript.fileType as 'doc' | 'docx' | 'pdf',
        uploadedAt: new Date(result.data.manuscript.uploadedAt || Date.now())
      },
      recommendations: result.data.recommendations.map(transformRecommendation),
      generatedAt: new Date(result.data.generatedAt),
      analysisNotes: result.data.analysisNotes,
      suggestedKeywords: result.data.suggestedKeywords
    };

    steps[5].status = 'complete';
    onProgress(6, steps);

    return report;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

export async function analyzeText(
  title: string,
  abstract: string,
  filters?: RecommendationFilters
): Promise<RecommendationReport> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId
    },
    body: JSON.stringify({ title, abstract, filters })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Analysis failed');
  }

  return {
    id: result.data.id,
    manuscript: {
      id: result.data.manuscript.id,
      title: result.data.manuscript.title,
      abstract: result.data.manuscript.abstract,
      fileName: result.data.manuscript.fileName,
      fileType: 'pdf',
      uploadedAt: new Date()
    },
    recommendations: result.data.recommendations.map(transformRecommendation),
    generatedAt: new Date(result.data.generatedAt),
    analysisNotes: result.data.analysisNotes,
    suggestedKeywords: result.data.suggestedKeywords
  };
}

export async function getJournals(filters: JournalFilters = {}): Promise<PaginatedResponse<Journal>> {
  const params = new URLSearchParams();

  if (filters.quartile?.length) params.append('quartile', filters.quartile.join(','));
  if (filters.areas?.length) params.append('areas', filters.areas.join(','));
  if (filters.openAccess !== undefined) params.append('openAccess', String(filters.openAccess));
  if (filters.minSjr) params.append('minSjr', String(filters.minSjr));
  if (filters.maxSjr) params.append('maxSjr', String(filters.maxSjr));
  if (filters.minHIndex) params.append('minHIndex', String(filters.minHIndex));
  if (filters.search) params.append('search', filters.search);
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));

  const response = await fetch(`${API_BASE_URL}/api/journals?${params.toString()}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch journals');
  }

  return {
    success: true,
    data: result.data.map(transformJournal),
    pagination: result.pagination
  };
}

export async function getJournalById(id: string): Promise<Journal | null> {
  const response = await fetch(`${API_BASE_URL}/api/journals/${id}`);
  const result = await response.json();

  if (!result.success) {
    return null;
  }

  return transformJournal(result.data);
}

export async function searchJournalsByScope(query: string, limit = 20): Promise<Journal[]> {
  const response = await fetch(`${API_BASE_URL}/api/journals/search/scope?q=${encodeURIComponent(query)}&limit=${limit}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Search failed');
  }

  return result.data.map(transformJournal);
}

export async function getSubjectAreas(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/areas`);
  const result = await response.json();

  if (!result.success) {
    return [];
  }

  return result.data;
}

export async function getCategories(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`);
  const result = await response.json();

  if (!result.success) {
    return [];
  }

  return result.data;
}

export async function getStats(): Promise<{
  total: number;
  byQuartile: Record<string, number>;
  openAccess: number;
  withScope: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/stats`);
  const result = await response.json();

  if (!result.success) {
    return { total: 0, byQuartile: {}, openAccess: 0, withScope: 0 };
  }

  return result.data;
}

export async function checkHealth(): Promise<{
  status: string;
  database: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return await response.json();
  } catch {
    return { status: 'error', database: 'disconnected' };
  }
}

export async function getPublishers(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/publishers`);
  const result = await response.json();

  if (!result.success) {
    return [];
  }

  return result.data;
}
