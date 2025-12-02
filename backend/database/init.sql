-- Journal Recommender Database Schema
-- IDEMPOTENT: Safe to run multiple times

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- Journals table
CREATE TABLE IF NOT EXISTS journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    publisher VARCHAR(255) DEFAULT 'World Scientific',
    country VARCHAR(100),
    open_access BOOLEAN DEFAULT FALSE,
    coverage VARCHAR(50),
    scimago_rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal ISSN (multiple per journal)
CREATE TABLE IF NOT EXISTS journal_issn (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
    issn VARCHAR(20) NOT NULL,
    UNIQUE(journal_id, issn)
);

-- Journal metrics
CREATE TABLE IF NOT EXISTS journal_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID UNIQUE REFERENCES journals(id) ON DELETE CASCADE,
    sjr DECIMAL(10,4),
    sjr_quartile VARCHAR(5),
    h_index INTEGER,
    total_docs_2024 INTEGER,
    total_docs_3years INTEGER,
    citations_per_doc DECIMAL(10,4),
    total_citations_3years INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal scope/description
CREATE TABLE IF NOT EXISTS journal_scopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID UNIQUE REFERENCES journals(id) ON DELETE CASCADE,
    scope_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subject areas
CREATE TABLE IF NOT EXISTS subject_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Journal-Area relationship
CREATE TABLE IF NOT EXISTS journal_areas (
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
    area_id UUID REFERENCES subject_areas(id) ON DELETE CASCADE,
    PRIMARY KEY (journal_id, area_id)
);

-- Categories with quartile rankings
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    UNIQUE(name)
);

-- Journal-Category relationship with quartile
CREATE TABLE IF NOT EXISTS journal_categories (
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    quartile VARCHAR(5),
    PRIMARY KEY (journal_id, category_id)
);

-- Manuscripts (user uploads)
CREATE TABLE IF NOT EXISTS manuscripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(1000) NOT NULL,
    abstract TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(20),
    file_path VARCHAR(500),
    user_session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manuscript_id UUID REFERENCES manuscripts(id) ON DELETE CASCADE,
    suggested_keywords TEXT[],
    analysis_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL,
    rank INTEGER NOT NULL,
    match_reason TEXT,
    pros TEXT[],
    cons TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Search history (for analytics)
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_session_id VARCHAR(100),
    query_type VARCHAR(50), -- 'file_upload', 'text_input', 'browse'
    search_filters JSONB,
    results_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_journals_title ON journals USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_journals_publisher ON journals(publisher);
CREATE INDEX IF NOT EXISTS idx_journal_metrics_sjr ON journal_metrics(sjr DESC);
CREATE INDEX IF NOT EXISTS idx_journal_metrics_h_index ON journal_metrics(h_index DESC);
CREATE INDEX IF NOT EXISTS idx_journal_metrics_quartile ON journal_metrics(sjr_quartile);
CREATE INDEX IF NOT EXISTS idx_journal_scopes_text ON journal_scopes USING gin(scope_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recommendations_score ON recommendations(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_manuscripts_session ON manuscripts(user_session_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_journals_fts ON journals USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_scopes_fts ON journal_scopes USING gin(to_tsvector('english', scope_text));

-- Trigger function to update timestamps (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate triggers (idempotent approach)
DROP TRIGGER IF EXISTS update_journals_updated_at ON journals;
CREATE TRIGGER update_journals_updated_at
    BEFORE UPDATE ON journals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_metrics_updated_at ON journal_metrics;
CREATE TRIGGER update_journal_metrics_updated_at
    BEFORE UPDATE ON journal_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for easy journal querying (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE VIEW v_journals_full AS
SELECT
    j.id,
    j.source_id,
    j.title,
    j.publisher,
    j.country,
    j.open_access,
    j.coverage,
    j.scimago_rank,
    m.sjr,
    m.sjr_quartile,
    m.h_index,
    m.total_docs_2024,
    m.total_docs_3years,
    m.citations_per_doc,
    m.total_citations_3years,
    s.scope_text,
    ARRAY_AGG(DISTINCT i.issn) FILTER (WHERE i.issn IS NOT NULL) as issns,
    ARRAY_AGG(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL) as areas,
    JSONB_AGG(DISTINCT jsonb_build_object('name', c.name, 'quartile', jc.quartile))
        FILTER (WHERE c.name IS NOT NULL) as categories
FROM journals j
LEFT JOIN journal_metrics m ON j.id = m.journal_id
LEFT JOIN journal_scopes s ON j.id = s.journal_id
LEFT JOIN journal_issn i ON j.id = i.journal_id
LEFT JOIN journal_areas ja ON j.id = ja.journal_id
LEFT JOIN subject_areas a ON ja.area_id = a.id
LEFT JOIN journal_categories jc ON j.id = jc.journal_id
LEFT JOIN categories c ON jc.category_id = c.id
GROUP BY j.id, j.source_id, j.title, j.publisher, j.country, j.open_access,
         j.coverage, j.scimago_rank, m.sjr, m.sjr_quartile, m.h_index,
         m.total_docs_2024, m.total_docs_3years, m.citations_per_doc,
         m.total_citations_3years, s.scope_text;
