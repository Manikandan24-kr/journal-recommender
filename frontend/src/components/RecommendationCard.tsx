import React, { useState } from 'react';
import {
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Award,
  Unlock,
  Lock,
  Globe,
  Calendar
} from 'lucide-react';
import type { JournalRecommendation } from '../types';

interface RecommendationCardProps {
  recommendation: JournalRecommendation;
  rank: number;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  rank
}) => {
  const [isExpanded, setIsExpanded] = useState(rank === 1);
  const { journal, matchScore, matchReasons, scopeAlignment, strengthsForJournal, potentialChallenges } = recommendation;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-violet-500 to-purple-500';
    if (score >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-violet-50 border-violet-200';
    if (score >= 40) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getMatchLabel = (score: number) => {
    if (score >= 80) return 'EXCELLENT MATCH';
    if (score >= 60) return 'GOOD MATCH';
    if (score >= 40) return 'AVERAGE MATCH';
    return 'LOW MATCH';
  };

  const getMatchLabelColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-violet-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRankBadge = () => {
    if (rank === 1) {
      return (
        <div className="absolute -top-2 -left-2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
          <Award className="h-5 w-5 text-white" />
        </div>
      );
    }
    return (
      <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center shadow-md">
        <span className="text-white text-sm font-bold">{rank}</span>
      </div>
    );
  };

  return (
    <div
      className={`relative bg-white rounded-xl border-2 transition-all duration-300 card-hover ${
        rank === 1 ? 'border-yellow-300 shadow-lg' : 'border-gray-200'
      }`}
    >
      {getRankBadge()}

      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-start sm:items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{journal.name}</h3>
              {journal.openAccess ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <Unlock className="h-3 w-3" />
                  Open Access
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  <Lock className="h-3 w-3" />
                  Subscription
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              <span>Published by: {journal.publisher}</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {journal.language}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {journal.frequency}
              </span>
            </div>
          </div>

          {/* Match Score */}
          <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 sm:text-right">
            <span className={`text-xs font-bold ${getMatchLabelColor(matchScore)}`}>
              {getMatchLabel(matchScore)}
            </span>
            <div className={`flex flex-col items-center p-2 sm:p-3 rounded-xl border sm:mt-1 ${getScoreBgColor(matchScore)}`}>
              <div className={`text-xl sm:text-2xl font-bold bg-gradient-to-r ${getScoreColor(matchScore)} bg-clip-text text-transparent`}>
                {matchScore}%
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics from Scimago */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 mb-4">
          <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-violet-50 text-violet-700 text-xs sm:text-sm font-medium rounded-lg border border-violet-200 text-center sm:text-left">
            SJR: {journal.metrics.sjrQuartile}
          </span>
          <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium rounded-lg border border-blue-200 text-center sm:text-left">
            SJR: {journal.metrics.sjrScore.toFixed(3)}
          </span>
          <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-cyan-50 text-cyan-700 text-xs sm:text-sm font-medium rounded-lg border border-cyan-200 text-center sm:text-left">
            H-Index: {journal.metrics.hIndex}
          </span>
          <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-50 text-green-700 text-xs sm:text-sm font-medium rounded-lg border border-green-200 text-center sm:text-left">
            Cites: {journal.metrics.citationsPerDoc.toFixed(2)}
          </span>
        </div>

        {/* Indexed In */}
        <div className="mb-3 sm:mb-4">
          <p className="text-xs font-medium text-gray-500 mb-1.5 sm:mb-2">Indexed in</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {journal.indexedIn.map((index, i) => (
              <span
                key={i}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-600 text-xs rounded"
              >
                {index}
              </span>
            ))}
          </div>
        </div>

        {/* Subjects Tags */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {journal.subjects.map((subject, index) => (
            <span
              key={index}
              className="px-2 sm:px-3 py-0.5 sm:py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-full"
            >
              {subject}
            </span>
          ))}
        </div>

        {/* Scope Alignment */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <p className="text-xs sm:text-sm text-gray-600">{scopeAlignment}</p>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
        >
          {isExpanded ? (
            <>
              <span>Show Less</span>
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>Show Details</span>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4 animate-fade-in">
            {/* Match Reasons */}
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                Why This Journal
              </h4>
              <ul className="space-y-1.5 sm:space-y-2">
                {matchReasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                    <span className="text-green-500 mt-0.5 sm:mt-1">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            {/* Strengths */}
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-500" />
                Your Manuscript's Strengths
              </h4>
              <ul className="space-y-1.5 sm:space-y-2">
                {strengthsForJournal.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                    <span className="text-violet-500 mt-0.5 sm:mt-1">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>

            {/* Challenges */}
            {potentialChallenges.length > 0 && (
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
                  Considerations
                </h4>
                <ul className="space-y-1.5 sm:space-y-2">
                  {potentialChallenges.map((challenge, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                      <span className="text-orange-500 mt-0.5 sm:mt-1">•</span>
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
