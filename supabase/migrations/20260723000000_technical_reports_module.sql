-- ============================================================================
-- PROJECTMATRIX — TECHNICAL REPORTS MODULE (PROGRESS, ENVIRONMENTAL, OHS)
-- ADDITIVE MIGRATION FOR /reports MODULE
-- ============================================================================

-- 1. Create technical_reports table
CREATE TABLE IF NOT EXISTS public.technical_reports (
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
    docx_file_path TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create technical_report_images table
CREATE TABLE IF NOT EXISTS public.technical_report_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technical_report_id UUID NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.technical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_report_images ENABLE ROW LEVEL SECURITY;

-- 4. Grants
GRANT ALL ON TABLE public.technical_reports TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.technical_report_images TO authenticated, anon, service_role;

-- 5. RLS Policies for technical_reports
DROP POLICY IF EXISTS select_technical_reports ON public.technical_reports;
DROP POLICY IF EXISTS insert_technical_reports ON public.technical_reports;
DROP POLICY IF EXISTS update_technical_reports ON public.technical_reports;
DROP POLICY IF EXISTS delete_technical_reports ON public.technical_reports;

CREATE POLICY select_technical_reports ON public.technical_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY insert_technical_reports ON public.technical_reports
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY update_technical_reports ON public.technical_reports
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY delete_technical_reports ON public.technical_reports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_reports.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_reports.project_id
              AND cm.profile_id = auth.uid()
        )
    );

-- 6. RLS Policies for technical_report_images
DROP POLICY IF EXISTS select_technical_report_images ON public.technical_report_images;
DROP POLICY IF EXISTS insert_technical_report_images ON public.technical_report_images;
DROP POLICY IF EXISTS update_technical_report_images ON public.technical_report_images;
DROP POLICY IF EXISTS delete_technical_report_images ON public.technical_report_images;

CREATE POLICY select_technical_report_images ON public.technical_report_images
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_report_images.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_report_images.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY insert_technical_report_images ON public.technical_report_images
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_report_images.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_report_images.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY update_technical_report_images ON public.technical_report_images
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_report_images.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_report_images.project_id
              AND cm.profile_id = auth.uid()
        )
    );

CREATE POLICY delete_technical_report_images ON public.technical_report_images
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = technical_report_images.company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE pm.project_id = technical_report_images.project_id
              AND cm.profile_id = auth.uid()
        )
    );

-- 7. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_technical_reports_updated_at ON public.technical_reports;
CREATE TRIGGER update_technical_reports_updated_at
    BEFORE UPDATE ON public.technical_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 8. Storage bucket setup for technical-reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('technical-reports', 'technical-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated users to insert to technical-reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select from technical-reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete from technical-reports" ON storage.objects;

CREATE POLICY "Allow authenticated users to insert to technical-reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'technical-reports' AND (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE cm.profile_id = auth.uid()
        )
    )
);

CREATE POLICY "Allow authenticated users to select from technical-reports"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'technical-reports' AND (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE cm.profile_id = auth.uid()
        )
    )
);

CREATE POLICY "Allow authenticated users to delete from technical-reports"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'technical-reports' AND (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.profile_id = auth.uid()
              AND cm.is_company_admin = TRUE
        )
        OR EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.company_members cm ON pm.company_member_id = cm.id
            WHERE cm.profile_id = auth.uid()
        )
    )
);
