-- ============================================================================
-- PROJECTMATRIX — PROJECT ADVISOR FILE-SEARCH REGISTRY FOUNDATION (HARDENED)
-- ADDITIVE MIGRATION FOR COMMUNICATION DOCUMENT RETRIEVAL (SECTION 17C.1A)
-- ============================================================================

BEGIN;

-- 1. Ensure composite unique index on public.projects(id, company_id) for composite foreign key integrity
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_id_company_id ON public.projects (id, company_id);

-- 2. Ensure composite unique index on public.communication_documents(id, company_id, project_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_documents_id_company_project ON public.communication_documents (id, company_id, project_id);

-- 3. Create project_advisor_file_search_stores table
CREATE TABLE IF NOT EXISTS public.project_advisor_file_search_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gemini_file_search',
    provider_store_name TEXT,
    display_name TEXT,
    embedding_model TEXT DEFAULT 'models/gemini-embedding-2',
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite FK ensuring project belongs to company
    CONSTRAINT pafss_project_company_fkey
        FOREIGN KEY (project_id, company_id)
        REFERENCES public.projects (id, company_id)
        ON DELETE CASCADE,

    -- Scope uniqueness
    CONSTRAINT pafss_company_project_key UNIQUE (company_id, project_id),
    CONSTRAINT pafss_id_company_project_key UNIQUE (id, company_id, project_id),
    CONSTRAINT pafss_provider_store_name_key UNIQUE (provider_store_name),

    -- Status constraint
    CONSTRAINT pafss_status_check CHECK (status IN ('pending', 'creating', 'ready', 'failed', 'deleting'))
);

-- Index for status filtering on stores
CREATE INDEX IF NOT EXISTS idx_pafss_status ON public.project_advisor_file_search_stores (status);

-- 4. Create project_advisor_indexed_documents table
CREATE TABLE IF NOT EXISTS public.project_advisor_indexed_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    project_id UUID NOT NULL,
    store_id UUID NOT NULL,
    communication_document_id UUID NOT NULL,
    source_kind TEXT NOT NULL,
    source_storage_path TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    source_mime_type TEXT,
    source_file_size BIGINT,
    source_fingerprint TEXT,
    provider_document_name TEXT,
    provider_operation_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite FK ensuring store_id matches company_id and project_id scope
    CONSTRAINT paid_store_company_project_fkey
        FOREIGN KEY (store_id, company_id, project_id)
        REFERENCES public.project_advisor_file_search_stores (id, company_id, project_id)
        ON DELETE CASCADE,

    -- Composite FK ensuring communication_document_id matches company_id and project_id scope
    CONSTRAINT paid_comm_doc_company_project_fkey
        FOREIGN KEY (communication_document_id, company_id, project_id)
        REFERENCES public.communication_documents (id, company_id, project_id)
        ON DELETE CASCADE,

    -- Uniqueness per document and source kind
    CONSTRAINT paid_comm_doc_source_kind_key UNIQUE (communication_document_id, source_kind),

    -- Check constraints
    CONSTRAINT paid_source_kind_check CHECK (source_kind IN ('uploaded', 'signed', 'generated')),
    CONSTRAINT paid_status_check CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'unsupported', 'deleting'))
);

-- Indexes for project_advisor_indexed_documents
CREATE INDEX IF NOT EXISTS idx_paid_company_project_status ON public.project_advisor_indexed_documents (company_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_paid_store ON public.project_advisor_indexed_documents (store_id);
CREATE INDEX IF NOT EXISTS idx_paid_provider_doc_name ON public.project_advisor_indexed_documents (provider_document_name) WHERE provider_document_name IS NOT NULL;

-- 5. Row Level Security Setup
ALTER TABLE public.project_advisor_file_search_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_advisor_indexed_documents ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-run
DROP POLICY IF EXISTS select_pafss ON public.project_advisor_file_search_stores;
DROP POLICY IF EXISTS select_paid ON public.project_advisor_indexed_documents;

-- SELECT policies for authenticated users verified via verify_membership_access
CREATE POLICY select_pafss ON public.project_advisor_file_search_stores
    FOR SELECT TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY select_paid ON public.project_advisor_indexed_documents
    FOR SELECT TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

-- Revoke default PUBLIC, anon, and authenticated privileges
REVOKE ALL ON TABLE public.project_advisor_file_search_stores FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_advisor_indexed_documents FROM PUBLIC, anon, authenticated;

-- Explicit SELECT grants to authenticated users (controlled by RLS policies)
GRANT SELECT ON TABLE public.project_advisor_file_search_stores TO authenticated;
GRANT SELECT ON TABLE public.project_advisor_indexed_documents TO authenticated;

-- Explicit ALL grants to service_role
GRANT ALL ON TABLE public.project_advisor_file_search_stores TO service_role;
GRANT ALL ON TABLE public.project_advisor_indexed_documents TO service_role;

COMMIT;
