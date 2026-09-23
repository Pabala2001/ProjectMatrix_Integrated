export const TECHNICAL_REPORTS_SQL_SNIPPET = `-- -------------------------------------------------------------
-- PROJECTMATRIX: REPORTS MODULE TABLE SCHEMA & STORAGE
-- -------------------------------------------------------------

-- 1. Create the reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('Progress', 'Environmental', 'Occupational Health and Safety')),
    frequency TEXT NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Monthly')),
    report_date DATE NOT NULL,
    report_month TEXT NOT NULL,
    report_year INTEGER NOT NULL,
    report_number TEXT,
    title TEXT,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final')),
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_path TEXT,
    docx_file_path TEXT,
    original_file_name TEXT,
    file_mime_type TEXT,
    file_size_bytes BIGINT,
    source_type TEXT DEFAULT 'Generated',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the report_images table
CREATE TABLE IF NOT EXISTS public.report_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) on tables
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;

-- Grant permissions explicitly
GRANT ALL ON TABLE public.reports TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.report_images TO authenticated, anon, service_role;

-- 4. Clean up any existing RLS policies
DROP POLICY IF EXISTS select_reports ON public.reports;
DROP POLICY IF EXISTS insert_reports ON public.reports;
DROP POLICY IF EXISTS update_reports ON public.reports;
DROP POLICY IF EXISTS delete_reports ON public.reports;

DROP POLICY IF EXISTS select_report_images ON public.report_images;
DROP POLICY IF EXISTS insert_report_images ON public.report_images;
DROP POLICY IF EXISTS update_report_images ON public.report_images;
DROP POLICY IF EXISTS delete_report_images ON public.report_images;

-- 5. Create RLS Policies for reports
CREATE POLICY select_reports ON public.reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY insert_reports ON public.reports
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY update_reports ON public.reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY delete_reports ON public.reports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

-- 6. Storage Bucket setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false), ('report-images', 'report-images', false)
ON CONFLICT (id) DO NOTHING;
`;
