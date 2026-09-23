-- Migration: 20260726000000_shared_accounts_attachments.sql
-- Description:
-- Shared Accounts document storage and metadata foundation for ProjectMatrix.
--
-- Security model:
--   Model A — finance-only access.
--   Only users who pass public.has_finance_full_access(company_id)
--   may view, upload, update, preview or download Accounts documents.
--
-- Storage path:
--   {company_id}/{record_type}/{record_id}/{uuid}-{sanitized_filename}

BEGIN;

-- ============================================================================
-- 1. STORAGE PATH HELPER
-- ============================================================================
-- Safely extracts a company UUID from the first folder in a Storage path.
-- Returns NULL instead of throwing an error when the path is malformed.

CREATE OR REPLACE FUNCTION public.accounts_company_id_from_storage_path(
  object_name text
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN split_part(object_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION
  public.accounts_company_id_from_storage_path(text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.accounts_company_id_from_storage_path(text)
TO authenticated;


-- ============================================================================
-- 2. STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'accounts-documents',
  'accounts-documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================================
-- 3. ACCOUNTS ATTACHMENTS TABLE CREATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounts_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id uuid NOT NULL
    REFERENCES public.companies(id)
    ON DELETE RESTRICT,

  project_id uuid
    REFERENCES public.projects(id)
    ON DELETE SET NULL,

  record_type text NOT NULL,
  record_id text NOT NULL,

  document_type text NOT NULL DEFAULT 'general',

  original_filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,

  description text,

  uploaded_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 4. EXISTING-DATA REPAIR & PREFLIGHT VALIDATION
-- ============================================================================

DO $$
DECLARE
  v_invalid_count integer := 0;
  v_details text := '';
  v_count integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'accounts_attachments'
  ) THEN
    -- Safe automated data repairs
    UPDATE public.accounts_attachments
    SET mime_type = 'image/jpeg'
    WHERE mime_type = 'image/jpg';

    UPDATE public.accounts_attachments
    SET record_type = lower(trim(record_type))
    WHERE record_type IS NOT NULL AND record_type != lower(trim(record_type));

    UPDATE public.accounts_attachments
    SET document_type = lower(trim(document_type))
    WHERE document_type IS NOT NULL AND document_type != lower(trim(document_type));

    UPDATE public.accounts_attachments
    SET document_type = 'general'
    WHERE document_type IS NULL OR length(trim(document_type)) = 0;

    UPDATE public.accounts_attachments
    SET is_archived = false
    WHERE is_archived IS NULL;

    UPDATE public.accounts_attachments
    SET uploaded_at = now()
    WHERE uploaded_at IS NULL;

    UPDATE public.accounts_attachments
    SET created_at = now()
    WHERE created_at IS NULL;

    UPDATE public.accounts_attachments
    SET updated_at = now()
    WHERE updated_at IS NULL;

    -- Preflight checks
    -- 1. Invalid or missing record_type
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE record_type IS NULL 
       OR length(trim(record_type)) = 0 
       OR record_type !~ '^[a-z][a-z0-9_]{0,79}$';
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with invalid or missing record_type%s', v_count, chr(10));
    END IF;

    -- 2. Invalid or missing record_id
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE record_id IS NULL 
       OR length(trim(record_id)) = 0 
       OR length(record_id) > 255;
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with invalid or missing record_id%s', v_count, chr(10));
    END IF;

    -- 3. Invalid or missing document_type
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE document_type IS NULL 
       OR length(trim(document_type)) = 0 
       OR document_type !~ '^[a-z][a-z0-9_]{0,79}$';
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with invalid or missing document_type%s', v_count, chr(10));
    END IF;

    -- 4. Invalid or missing original_filename
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE original_filename IS NULL 
       OR length(trim(original_filename)) = 0 
       OR length(original_filename) > 255;
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with invalid or missing original_filename%s', v_count, chr(10));
    END IF;

    -- 5. Invalid or missing storage_path, length, or company UUID mismatch
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE storage_path IS NULL 
       OR length(trim(storage_path)) = 0 
       OR length(storage_path) > 1024
       OR public.accounts_company_id_from_storage_path(storage_path) IS NULL
       OR public.accounts_company_id_from_storage_path(storage_path) IS DISTINCT FROM company_id;
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with invalid storage_path or company_id path mismatch%s', v_count, chr(10));
    END IF;

    -- 6. Duplicate storage_path
    SELECT COUNT(*) INTO v_count
    FROM (
      SELECT storage_path FROM public.accounts_attachments
      WHERE storage_path IS NOT NULL
      GROUP BY storage_path HAVING COUNT(*) > 1
    ) sub;
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s duplicate storage_path value(s)%s', v_count, chr(10));
    END IF;

    -- 7. Invalid mime_type
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE mime_type IS NULL OR mime_type NOT IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/png',
      'image/jpeg'
    );
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with unsupported or missing mime_type%s', v_count, chr(10));
    END IF;

    -- 8. Invalid file_size_bytes
    SELECT COUNT(*) INTO v_count
    FROM public.accounts_attachments
    WHERE file_size_bytes IS NULL OR file_size_bytes <= 0 OR file_size_bytes > 20971520;
    IF v_count > 0 THEN
      v_invalid_count := v_invalid_count + v_count;
      v_details := v_details || format(' - %s row(s) with invalid file_size_bytes (<= 0 or > 20MB)%s', v_count, chr(10));
    END IF;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Accounts attachments migration preflight failed! Found % invalid record(s) in public.accounts_attachments:%s%s',
        v_invalid_count, chr(10), v_details;
    END IF;
  END IF;
END;
$$;


-- ============================================================================
-- 5. EXPLICIT COLUMN RECONCILIATION, DEFAULTS & NOT NULL ASSIGNMENTS
-- ============================================================================

ALTER TABLE public.accounts_attachments
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS record_type text,
  ADD COLUMN IF NOT EXISTS record_id text,
  ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.accounts_attachments
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN document_type SET DEFAULT 'general',
  ALTER COLUMN uploaded_at SET DEFAULT now(),
  ALTER COLUMN is_archived SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.accounts_attachments
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN record_type SET NOT NULL,
  ALTER COLUMN record_id SET NOT NULL,
  ALTER COLUMN document_type SET NOT NULL,
  ALTER COLUMN original_filename SET NOT NULL,
  ALTER COLUMN storage_path SET NOT NULL,
  ALTER COLUMN mime_type SET NOT NULL,
  ALTER COLUMN file_size_bytes SET NOT NULL,
  ALTER COLUMN uploaded_at SET NOT NULL,
  ALTER COLUMN is_archived SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;


-- ============================================================================
-- 6. FOREIGN KEYS & CONSTRAINTS RECONCILIATION
-- ============================================================================

ALTER TABLE public.accounts_attachments
  DROP CONSTRAINT IF EXISTS uq_accounts_attach_comp,
  DROP CONSTRAINT IF EXISTS uq_accounts_attachments_storage_path,
  DROP CONSTRAINT IF EXISTS fk_accounts_attachments_company,
  DROP CONSTRAINT IF EXISTS fk_accounts_attachments_project,
  DROP CONSTRAINT IF EXISTS fk_accounts_attachments_uploaded_by,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_record_type,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_record_id,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_document_type,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_filename,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_storage_path,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_mime_type,
  DROP CONSTRAINT IF EXISTS chk_accounts_attachment_file_size;

ALTER TABLE public.accounts_attachments
  ADD CONSTRAINT uq_accounts_attachments_storage_path
    UNIQUE (storage_path),

  ADD CONSTRAINT fk_accounts_attachments_company
    FOREIGN KEY (company_id)
    REFERENCES public.companies(id)
    ON DELETE RESTRICT,

  ADD CONSTRAINT fk_accounts_attachments_project
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE SET NULL,

  ADD CONSTRAINT fk_accounts_attachments_uploaded_by
    FOREIGN KEY (uploaded_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  ADD CONSTRAINT chk_accounts_attachment_record_type
    CHECK (
      record_type = lower(record_type)
      AND record_type ~ '^[a-z][a-z0-9_]{0,79}$'
    ),

  ADD CONSTRAINT chk_accounts_attachment_record_id
    CHECK (
      length(trim(record_id)) > 0
      AND length(record_id) <= 255
    ),

  ADD CONSTRAINT chk_accounts_attachment_document_type
    CHECK (
      document_type = lower(document_type)
      AND document_type ~ '^[a-z][a-z0-9_]{0,79}$'
    ),

  ADD CONSTRAINT chk_accounts_attachment_filename
    CHECK (
      length(trim(original_filename)) > 0
      AND length(original_filename) <= 255
    ),

  ADD CONSTRAINT chk_accounts_attachment_storage_path
    CHECK (
      length(trim(storage_path)) > 0
      AND length(storage_path) <= 1024
      AND public.accounts_company_id_from_storage_path(storage_path) = company_id
    ),

  ADD CONSTRAINT chk_accounts_attachment_mime_type
    CHECK (
      mime_type IN (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'image/png',
        'image/jpeg'
      )
    ),

  ADD CONSTRAINT chk_accounts_attachment_file_size
    CHECK (
      file_size_bytes > 0
      AND file_size_bytes <= 20971520
    );


-- ============================================================================
-- 7. TRIGGERS & FUNCTIONS RECONCILIATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_accounts_attachments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_attach_updated_at
ON public.accounts_attachments;

CREATE TRIGGER trg_accounts_attach_updated_at
BEFORE UPDATE ON public.accounts_attachments
FOR EACH ROW
EXECUTE FUNCTION public.fn_accounts_attachments_set_updated_at();


CREATE OR REPLACE FUNCTION public.fn_accounts_attachment_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Attachment ID cannot be changed.';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Attachment company cannot be changed.';
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Attachment project cannot be changed.';
  END IF;

  IF NEW.record_type IS DISTINCT FROM OLD.record_type THEN
    RAISE EXCEPTION 'Attachment record type cannot be changed.';
  END IF;

  IF NEW.record_id IS DISTINCT FROM OLD.record_id THEN
    RAISE EXCEPTION 'Attachment record ID cannot be changed.';
  END IF;

  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'Attachment Storage path cannot be changed.';
  END IF;

  IF NEW.original_filename IS DISTINCT FROM OLD.original_filename THEN
    RAISE EXCEPTION 'Attachment original filename cannot be changed.';
  END IF;

  IF NEW.mime_type IS DISTINCT FROM OLD.mime_type THEN
    RAISE EXCEPTION 'Attachment MIME type cannot be changed.';
  END IF;

  IF NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes THEN
    RAISE EXCEPTION 'Attachment file size cannot be changed.';
  END IF;

  IF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    RAISE EXCEPTION 'Attachment uploader cannot be changed.';
  END IF;

  IF NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
    RAISE EXCEPTION 'Attachment upload date cannot be changed.';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Attachment creation date cannot be changed.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_attachment_protect_identity
ON public.accounts_attachments;

CREATE TRIGGER trg_accounts_attachment_protect_identity
BEFORE UPDATE ON public.accounts_attachments
FOR EACH ROW
EXECUTE FUNCTION public.fn_accounts_attachment_protect_identity();


-- ============================================================================
-- 8. INDEXES RECONCILIATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_attach_company
  ON public.accounts_attachments(company_id);

CREATE INDEX IF NOT EXISTS idx_accounts_attach_project
  ON public.accounts_attachments(project_id);

CREATE INDEX IF NOT EXISTS idx_accounts_attach_record_type
  ON public.accounts_attachments(record_type);

CREATE INDEX IF NOT EXISTS idx_accounts_attach_record_id
  ON public.accounts_attachments(record_id);

CREATE INDEX IF NOT EXISTS idx_accounts_attach_type_id
  ON public.accounts_attachments(
    company_id,
    record_type,
    record_id
  );

CREATE INDEX IF NOT EXISTS idx_accounts_attach_company_document_type
  ON public.accounts_attachments(
    company_id,
    document_type
  );

CREATE INDEX IF NOT EXISTS idx_accounts_attach_active_company
  ON public.accounts_attachments(
    company_id,
    uploaded_at DESC
  )
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_accounts_attach_archived_company
  ON public.accounts_attachments(
    company_id,
    uploaded_at DESC
  )
  WHERE is_archived = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_attachments_storage_path_idx
  ON public.accounts_attachments(storage_path);


-- ============================================================================
-- 9. TABLE PRIVILEGES & ROW LEVEL SECURITY
-- ============================================================================

REVOKE ALL ON TABLE public.accounts_attachments FROM anon;
REVOKE ALL ON TABLE public.accounts_attachments FROM authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.accounts_attachments
TO authenticated;

ALTER TABLE public.accounts_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_accounts_attach_all
ON public.accounts_attachments;

DROP POLICY IF EXISTS accounts_attachments_select
ON public.accounts_attachments;

DROP POLICY IF EXISTS accounts_attachments_insert
ON public.accounts_attachments;

DROP POLICY IF EXISTS accounts_attachments_update
ON public.accounts_attachments;

DROP POLICY IF EXISTS accounts_attachments_delete
ON public.accounts_attachments;

CREATE POLICY accounts_attachments_select
ON public.accounts_attachments
FOR SELECT
TO authenticated
USING (
  public.has_finance_full_access(company_id)
);

CREATE POLICY accounts_attachments_insert
ON public.accounts_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_finance_full_access(company_id)
  AND uploaded_by = auth.uid()
  AND public.accounts_company_id_from_storage_path(storage_path) = company_id
);

CREATE POLICY accounts_attachments_update
ON public.accounts_attachments
FOR UPDATE
TO authenticated
USING (
  public.has_finance_full_access(company_id)
)
WITH CHECK (
  public.has_finance_full_access(company_id)
  AND public.accounts_company_id_from_storage_path(storage_path) = company_id
);


-- ============================================================================
-- 10. STORAGE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can select objects in accounts-documents"
ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can insert objects in accounts-documents"
ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can update objects in accounts-documents"
ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can delete objects in accounts-documents"
ON storage.objects;

DROP POLICY IF EXISTS accounts_documents_select
ON storage.objects;

DROP POLICY IF EXISTS accounts_documents_insert
ON storage.objects;

DROP POLICY IF EXISTS accounts_documents_update
ON storage.objects;

DROP POLICY IF EXISTS accounts_documents_delete_orphan
ON storage.objects;

CREATE POLICY accounts_documents_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'accounts-documents'
  AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
  AND public.has_finance_full_access(
    public.accounts_company_id_from_storage_path(name)
  )
);

CREATE POLICY accounts_documents_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'accounts-documents'
  AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
  AND public.has_finance_full_access(
    public.accounts_company_id_from_storage_path(name)
  )
);

CREATE POLICY accounts_documents_delete_orphan
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'accounts-documents'
  AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
  AND public.has_finance_full_access(
    public.accounts_company_id_from_storage_path(name)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounts_attachments aa
    WHERE aa.storage_path = storage.objects.name
  )
);

COMMIT;
