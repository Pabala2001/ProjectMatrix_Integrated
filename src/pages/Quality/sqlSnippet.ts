export const QUALITY_CONTROL_SQL_SNIPPET = `-- -------------------------------------------------------------
-- PROJECTMATRIX: QUALITY CONTROL MODULE TABLE & STORAGE SCHEMA
-- -------------------------------------------------------------

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the quality_control_records table (or alter if it already exists)
CREATE TABLE IF NOT EXISTS public.quality_control_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    category TEXT NOT NULL,
    project_id UUID NULL,
    project_name TEXT NULL,
    project_number TEXT NULL,
    contract_number TEXT NULL,
    contractor TEXT NULL,
    location TEXT NULL,
    item TEXT NULL,
    company_name TEXT NULL,
    company_logo_base64 TEXT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restrict status to specific allowed values
    CONSTRAINT status_check CHECK (status IN ('Draft', 'Completed', 'Approved', 'Rejected'))
);

-- 2. Alter table to support advanced offline asset metadata and Storage paths
-- Run these safe migrations to add nullable asset metadata columns
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS company_logo_bucket TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS company_logo_path TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS company_logo_file_name TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS company_logo_mime_type TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS company_logo_file_size BIGINT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS company_logo_uploaded_at TIMESTAMPTZ NULL;

ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS contractor_signature_bucket TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS contractor_signature_path TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS contractor_signature_file_name TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS contractor_signature_mime_type TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS contractor_signature_file_size BIGINT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS contractor_signature_uploaded_at TIMESTAMPTZ NULL;

ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS resident_signature_bucket TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS resident_signature_path TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS resident_signature_file_name TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS resident_signature_mime_type TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS resident_signature_file_size BIGINT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS resident_signature_uploaded_at TIMESTAMPTZ NULL;

ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS inspector_signature_bucket TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS inspector_signature_path TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS inspector_signature_file_name TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS inspector_signature_mime_type TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS inspector_signature_file_size BIGINT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS inspector_signature_uploaded_at TIMESTAMPTZ NULL;

ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS docx_bucket TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS docx_path TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS docx_file_name TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS docx_mime_type TEXT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS docx_file_size BIGINT NULL;
ALTER TABLE public.quality_control_records ADD COLUMN IF NOT EXISTS docx_generated_at TIMESTAMPTZ NULL;

-- 3. Create useful indexes for quick querying and filtering
CREATE INDEX IF NOT EXISTS idx_qc_template_id ON public.quality_control_records(template_id);
CREATE INDEX IF NOT EXISTS idx_qc_category ON public.quality_control_records(category);
CREATE INDEX IF NOT EXISTS idx_qc_status ON public.quality_control_records(status);
CREATE INDEX IF NOT EXISTS idx_qc_project_id ON public.quality_control_records(project_id);
CREATE INDEX IF NOT EXISTS idx_qc_created_by ON public.quality_control_records(created_by);
CREATE INDEX IF NOT EXISTS idx_qc_created_at ON public.quality_control_records(created_at DESC);

-- 4. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_quality_control_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to the table
DROP TRIGGER IF EXISTS trigger_update_quality_control_updated_at ON public.quality_control_records;
CREATE TRIGGER trigger_update_quality_control_updated_at
    BEFORE UPDATE ON public.quality_control_records
    FOR EACH ROW
    EXECUTE FUNCTION update_quality_control_updated_at();

-- 5. Enable Row Level Security (RLS) on records
ALTER TABLE public.quality_control_records ENABLE ROW LEVEL SECURITY;

-- Grant permissions explicitly to authenticated, anon, and service_role to avoid 42501 "permission denied"
GRANT ALL ON TABLE public.quality_control_records TO authenticated, anon, service_role;

-- 6. Create Permissive Policies for Testing & Development
-- Policy for selecting/reading records
DROP POLICY IF EXISTS "Allow select quality control records" ON public.quality_control_records;
CREATE POLICY "Allow select quality control records" ON public.quality_control_records
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy for inserting records (allows setting created_by to auth.uid() or leaving as null)
DROP POLICY IF EXISTS "Allow insert quality control records" ON public.quality_control_records;
CREATE POLICY "Allow insert quality control records" ON public.quality_control_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by IS NULL OR created_by = auth.uid()
    );

-- Policy for updating records (allows update by any authenticated user for development)
DROP POLICY IF EXISTS "Allow update quality control records" ON public.quality_control_records;
CREATE POLICY "Allow update quality control records" ON public.quality_control_records
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy for deleting records (allows deletion by any authenticated user for development)
DROP POLICY IF EXISTS "Allow delete quality control records" ON public.quality_control_records;
CREATE POLICY "Allow delete quality control records" ON public.quality_control_records
    FOR DELETE
    TO authenticated
    USING (true);

-- 7. Setup Private Storage Buckets
-- Note: inserting directly into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('quality-control-assets', 'quality-control-assets', false, null, null),
  ('quality-control-documents', 'quality-control-documents', false, null, null)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 8. Setup RLS Storage Policies for development testing phase (for authenticated users)

-- Drop existing policies if they exist to prevent duplication
DROP POLICY IF EXISTS "Allow auth select on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on quality-control-assets" ON storage.objects;

DROP POLICY IF EXISTS "Allow auth select on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on quality-control-documents" ON storage.objects;

-- Policies for quality-control-assets bucket
CREATE POLICY "Allow auth select on quality-control-assets" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'quality-control-assets');

CREATE POLICY "Allow auth insert on quality-control-assets" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quality-control-assets');

CREATE POLICY "Allow auth update on quality-control-assets" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'quality-control-assets') WITH CHECK (bucket_id = 'quality-control-assets');

CREATE POLICY "Allow auth delete on quality-control-assets" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'quality-control-assets');

-- Policies for quality-control-documents bucket
CREATE POLICY "Allow auth select on quality-control-documents" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'quality-control-documents');

CREATE POLICY "Allow auth insert on quality-control-documents" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quality-control-documents');

CREATE POLICY "Allow auth update on quality-control-documents" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'quality-control-documents') WITH CHECK (bucket_id = 'quality-control-documents');

CREATE POLICY "Allow auth delete on quality-control-documents" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'quality-control-documents');

-- 9. Verification Query
-- SELECT * FROM public.quality_control_records ORDER BY created_at DESC;
`;
