import { useState, useCallback } from 'react';
import {
  Header,
  FileUpload,
  AnalysisProgress,
  RecommendationReport,
  PreAnalysisFilters,
  Login
} from './components';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { AnalysisStep, RecommendationReport as Report } from './types';
import { uploadAndAnalyze, analysisSteps, type RecommendationFilters } from './services/api';
import { Sparkles, BookOpen, Target, Zap } from 'lucide-react';

type AppState = 'idle' | 'analyzing' | 'complete';

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <MainApp />;
}

function MainApp() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<AnalysisStep[]>(analysisSteps);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendationFilters, setRecommendationFilters] = useState<RecommendationFilters>({});

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return;

    setAppState('analyzing');
    setSteps([...analysisSteps]);
    setCurrentStep(0);

    try {
      // Pass filters if any are set
      const hasFilters = Object.values(recommendationFilters).some(v =>
        v !== undefined && v !== null &&
        (Array.isArray(v) ? v.length > 0 : true)
      );

      const result = await uploadAndAnalyze(
        selectedFile,
        (step, updatedSteps) => {
          setCurrentStep(step);
          setSteps([...updatedSteps]);
        },
        hasFilters ? recommendationFilters : undefined
      );
      setReport(result);
      setAppState('complete');
    } catch (err) {
      setError('An error occurred while analyzing your manuscript. Please try again.');
      setAppState('idle');
    }
  }, [selectedFile, recommendationFilters]);

  const handleStartOver = useCallback(() => {
    setAppState('idle');
    setSelectedFile(null);
    setReport(null);
    setCurrentStep(0);
    setSteps([...analysisSteps]);
    setError(null);
    setRecommendationFilters({});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          {/* Page Header */}
          {appState !== 'complete' && (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Journal Scope Matcher
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-500 ml-8 sm:ml-12">
                Upload your manuscript to find the perfect journals for your research
              </p>
            </div>
          )}

          {/* Main Content */}
          {appState === 'idle' && (
            <>
              {/* Upload Section */}
              <div className="mb-6 sm:mb-8">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onRemoveFile={handleRemoveFile}
                  isUploading={false}
                />
              </div>

              {/* Pre-Analysis Filters (shown when file is selected) */}
              {selectedFile && (
                <div className="mb-6 sm:mb-8">
                  <PreAnalysisFilters
                    filters={recommendationFilters}
                    onFilterChange={setRecommendationFilters}
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs sm:text-sm">
                  {error}
                </div>
              )}

              {/* Analyze Button */}
              {selectedFile && (
                <div className="mb-6 sm:mb-8">
                  <button
                    onClick={handleAnalyze}
                    className="w-full py-3 sm:py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-200 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">Analyze & Find Matching Journals</span>
                    <span className="sm:hidden">Analyze Manuscript</span>
                  </button>
                </div>
              )}

              {/* Features Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 card-hover">
                  <div className="p-2 sm:p-3 bg-violet-100 rounded-xl w-fit mb-3 sm:mb-4">
                    <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Smart Matching</h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Analyzes your manuscript's title and abstract against comprehensive journal scope definitions
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 card-hover">
                  <div className="p-2 sm:p-3 bg-pink-100 rounded-xl w-fit mb-3 sm:mb-4">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Precision Scoring</h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Get ranked recommendations with detailed match scores and alignment explanations
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 card-hover sm:col-span-2 md:col-span-1">
                  <div className="p-2 sm:p-3 bg-orange-100 rounded-xl w-fit mb-3 sm:mb-4">
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">Quick Results</h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Receive comprehensive journal recommendations in under a minute
                  </p>
                </div>
              </div>

              {/* How It Works */}
              <div className="mt-8 sm:mt-12 bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 text-center">
                  How It Works
                </h2>
                <div className="grid grid-cols-2 md:flex md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 md:gap-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-violet-100 text-violet-600 font-bold flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-base">
                      1
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1 text-sm sm:text-base">Upload</h4>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Upload your manuscript
                    </p>
                  </div>

                  <div className="hidden md:block h-px w-8 lg:w-16 bg-gray-200" />

                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-pink-100 text-pink-600 font-bold flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-base">
                      2
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1 text-sm sm:text-base">Analyze</h4>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Extract key info
                    </p>
                  </div>

                  <div className="hidden md:block h-px w-8 lg:w-16 bg-gray-200" />

                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-base">
                      3
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1 text-sm sm:text-base">Match</h4>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Compare with journals
                    </p>
                  </div>

                  <div className="hidden md:block h-px w-8 lg:w-16 bg-gray-200" />

                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 text-green-600 font-bold flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-base">
                      4
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1 text-sm sm:text-base">Results</h4>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Get recommendations
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {appState === 'analyzing' && (
            <AnalysisProgress steps={steps} currentStep={currentStep} />
          )}

          {appState === 'complete' && report && (
            <RecommendationReport report={report} onStartOver={handleStartOver} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-3 sm:py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs sm:text-sm text-gray-500">
          Copyright © 2025{' '}
          <a href="#" className="text-violet-600 hover:underline">
            Kriyadocs
          </a>{' '}
          <span className="hidden sm:inline">by Exeter Premedia Services, India.</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
