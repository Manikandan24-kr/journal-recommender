import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Share2,
  Printer,
  Tag,
  Calendar,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';
import type { RecommendationReport as Report, MetricFilter } from '../types';
import RecommendationCard from './RecommendationCard';
import FilterPanel from './FilterPanel';

interface RecommendationReportProps {
  report: Report;
  onStartOver: () => void;
}

const RecommendationReport: React.FC<RecommendationReportProps> = ({
  report,
  onStartOver
}) => {
  const { manuscript, recommendations, analysisNotes, suggestedKeywords, generatedAt } = report;

  const [filters, setFilters] = useState<MetricFilter>({
    sjrQuartile: null,
    sjrScore: null,
    hIndex: null,
    citationsPerDoc: null,
    openAccess: null,
    indexedIn: null,
    publisher: null
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Get unique indexes and publishers for filter options
  const availableIndexes = useMemo(() => {
    const indexes = new Set<string>();
    recommendations.forEach(rec => {
      rec.journal.indexedIn.forEach(idx => indexes.add(idx));
    });
    return Array.from(indexes).sort();
  }, [recommendations]);

  const availablePublishers = useMemo(() => {
    const publishers = new Set<string>();
    recommendations.forEach(rec => {
      publishers.add(rec.journal.publisher);
    });
    return Array.from(publishers).sort();
  }, [recommendations]);

  // Filter recommendations based on active filters
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      const journal = rec.journal;

      // SJR Quartile filter
      if (filters.sjrQuartile && filters.sjrQuartile.length > 0) {
        if (!filters.sjrQuartile.includes(journal.metrics.sjrQuartile)) {
          return false;
        }
      }

      // H-Index filter
      if (filters.hIndex) {
        const hIndex = journal.metrics.hIndex;
        if (hIndex < filters.hIndex.min || hIndex > filters.hIndex.max) {
          return false;
        }
      }

      // SJR Score filter
      if (filters.sjrScore) {
        const sjrScore = journal.metrics.sjrScore;
        if (sjrScore < filters.sjrScore.min || sjrScore > filters.sjrScore.max) {
          return false;
        }
      }

      // Citations per Doc filter
      if (filters.citationsPerDoc) {
        const citationsPerDoc = journal.metrics.citationsPerDoc;
        if (citationsPerDoc < filters.citationsPerDoc.min || citationsPerDoc > filters.citationsPerDoc.max) {
          return false;
        }
      }

      // Open Access filter
      if (filters.openAccess !== null) {
        if (journal.openAccess !== filters.openAccess) {
          return false;
        }
      }

      // Indexed In filter
      if (filters.indexedIn && filters.indexedIn.length > 0) {
        const hasMatchingIndex = filters.indexedIn.some(idx =>
          journal.indexedIn.includes(idx)
        );
        if (!hasMatchingIndex) {
          return false;
        }
      }

      // Publisher filter
      if (filters.publisher && filters.publisher.length > 0) {
        if (!filters.publisher.includes(journal.publisher)) {
          return false;
        }
      }

      return true;
    });
  }, [recommendations, filters]);

  const hasActiveFilters = Object.values(filters).some(v => v !== null);

  const clearFilters = () => {
    setFilters({
      sjrQuartile: null,
      sjrScore: null,
      hIndex: null,
      citationsPerDoc: null,
      openAccess: null,
      indexedIn: null,
      publisher: null
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Report Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl flex-shrink-0">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Journal Recommendations Report
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                Generated on {generatedAt.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 self-end sm:self-start">
            <button className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors hidden sm:block">
              <Printer className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
              <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manuscript Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Manuscript Summary</h3>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title</label>
            <p className="mt-1 text-sm sm:text-base text-gray-900 font-medium">{manuscript.title}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Abstract</label>
            <p className="mt-1 text-gray-700 text-xs sm:text-sm leading-relaxed line-clamp-4 sm:line-clamp-none">{manuscript.abstract}</p>
          </div>

          {/* Suggested Keywords */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Tag className="h-3 w-3" />
              Identified Keywords
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
              {suggestedKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-2 sm:px-3 py-0.5 sm:py-1 bg-violet-100 text-violet-700 text-xs sm:text-sm font-medium rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Notes */}
      <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-xl border border-violet-200 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="p-1.5 sm:p-2 bg-violet-100 rounded-lg flex-shrink-0">
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-violet-900 mb-1 text-sm sm:text-base">Analysis Summary</h4>
            <p className="text-xs sm:text-sm text-violet-700">{analysisNotes}</p>
          </div>
        </div>
      </div>

      {/* Recommendations Header with Mobile Filter Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {filteredRecommendations.length} Journal Matches
            {filteredRecommendations.length !== recommendations.length && (
              <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
                (filtered from {recommendations.length})
              </span>
            )}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Ranked by scope alignment and suitability
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Filter Button */}
          <button
            onClick={() => setShowMobileFilters(true)}
            className="lg:hidden inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-violet-600 hover:bg-violet-50 border border-violet-200 rounded-lg transition-colors text-sm font-medium"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-violet-600 rounded-full" />
            )}
          </button>
          <button
            onClick={onStartOver}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-violet-600 hover:bg-violet-50 border border-violet-200 rounded-lg transition-colors text-xs sm:text-sm font-medium"
          >
            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Analyze New Manuscript</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Main Content with Filter Panel */}
      <div className="flex gap-4 lg:gap-6">
        {/* Recommendations */}
        <div className="flex-1 space-y-3 sm:space-y-4">
          {filteredRecommendations.length > 0 ? (
            filteredRecommendations.map((rec, index) => (
              <RecommendationCard
                key={rec.journal.id}
                recommendation={rec}
                rank={index + 1}
              />
            ))
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center">
              <p className="text-gray-500 text-sm sm:text-base">No journals match your filter criteria.</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-violet-600 hover:text-violet-700 font-medium text-sm"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Desktop Filter Panel */}
        <div className="w-72 hidden lg:block">
          <FilterPanel
            filters={filters}
            onFilterChange={setFilters}
            availableIndexes={availableIndexes}
            availablePublishers={availablePublishers}
          />
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setShowMobileFilters(false)}
          />

          {/* Filter Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter Content */}
            <div className="h-[calc(100vh-112px)] overflow-y-auto">
              <FilterPanel
                filters={filters}
                onFilterChange={setFilters}
                availableIndexes={availableIndexes}
                availablePublishers={availablePublishers}
                isMobile={true}
              />
            </div>

            {/* Apply Button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-bottom">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors"
              >
                Apply Filters ({filteredRecommendations.length} results)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6 text-center">
        <p className="text-xs sm:text-sm text-gray-500">
          These recommendations are generated based on keyword matching analysis of your manuscript's title and abstract
          against journal scope definitions. We recommend reviewing each journal's detailed submission
          guidelines before submitting.
        </p>
      </div>
    </div>
  );
};

export default RecommendationReport;
