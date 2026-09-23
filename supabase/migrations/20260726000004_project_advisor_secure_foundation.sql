-- ProjectMatrix: Project Advisor secure database foundation
-- Migration ID: 20260726000004
--
-- Creates:
--   1. Role-aware Project Advisor access RPC
--   2. Conversation, message, and document-draft tables
--   3. Company/project integrity constraints
--   4. Ownership and timestamp triggers
--   5. Strict RLS policies and least-privilege API grants
--
-- Authorised company-wide roles:
--   CEO, CFO, COO, Director
--
-- Authorised assigned-project roles:
--   Project Manager, Senior Engineer, Junior Engineer,
--   Site Manager, Site Agent
--
-- Deliberately excluded as standalone access:
--   Company Admin, Member

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 0. Fail safely if the live schema does not match the audited dependencies,
--    or if an older Project Advisor foundation was already installed.
-- ---------------------------------------------------------------------------

DO $preflight$
DECLARE
    missing_columns TEXT[];
BEGIN
    SELECT pg_catalog.array_agg(
        required.schema_name || '.' ||
        required.table_name || '.' ||
        required.column_name
        ORDER BY required.schema_name, required.table_name, required.column_name
    )
    INTO missing_columns
    FROM (
        VALUES
            ('auth',   'users',           'id'),
            ('public', 'companies',       'id'),
            ('public', 'projects',        'id'),
            ('public', 'projects',        'company_id'),
            ('public', 'company_members', 'id'),
            ('public', 'company_members', 'company_id'),
            ('public', 'company_members', 'profile_id'),
            ('public', 'company_members', 'role'),
            ('public', 'company_members', 'designation'),
            ('public', 'company_members', 'login_enabled'),
            ('public', 'company_members', 'invite_status'),
            ('public', 'company_members', 'status'),
            ('public', 'company_members', 'is_active'),
            ('public', 'project_members', 'project_id'),
            ('public', 'project_members', 'company_member_id'),
            ('public', 'project_members', 'project_role'),
            ('public', 'project_members', 'designation')
    ) AS required(schema_name, table_name, column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns AS c
        WHERE c.table_schema = required.schema_name
          AND c.table_name = required.table_name
          AND c.column_name = required.column_name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION
            'Project Advisor migration stopped. Missing audited columns: %',
            pg_catalog.array_to_string(missing_columns, ', ');
    END IF;

    IF pg_catalog.to_regclass('public.project_advisor_conversations') IS NOT NULL
       OR pg_catalog.to_regclass('public.project_advisor_messages') IS NOT NULL
       OR pg_catalog.to_regclass('public.project_advisor_document_drafts') IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Project Advisor migration stopped because one or more Advisor tables already exist. Do not overwrite them; inspect the existing tables first.';
    END IF;
END;
$preflight$;

-- Reuse ProjectMatrix's standard composite project key. The project id is
-- already unique, so adding this constraint cannot introduce a duplicate-data
-- conflict when an older environment does not yet have it.
DO $project_key$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.projects'::regclass
          AND constraint_record.conname = 'projects_id_company_key'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_id_company_key
            UNIQUE (id, company_id);
    END IF;
END;
$project_key$;

-- ---------------------------------------------------------------------------
-- 1. Dedicated Project Advisor authorisation RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_project_advisor_access(
    co_id UUID,
    proj_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        auth.uid() IS NOT NULL
        AND co_id IS NOT NULL

        -- If a project is supplied, it must belong to the supplied company.
        AND (
            proj_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS p
                WHERE p.id = proj_id
                  AND p.company_id = co_id
            )
        )

        AND EXISTS (
            SELECT 1
            FROM public.company_members AS cm
            WHERE cm.company_id = co_id
              AND cm.profile_id = auth.uid()
              AND cm.is_active IS TRUE
              AND cm.login_enabled IS TRUE
              AND pg_catalog.lower(pg_catalog.btrim(cm.status)) = 'active'
              AND pg_catalog.lower(pg_catalog.btrim(cm.invite_status)) = 'accepted'
              AND (
                    -- Executives receive company-wide access and access to
                    -- every project belonging to their company.
                    pg_catalog.lower(
                        pg_catalog.btrim(COALESCE(cm.role, ''))
                    ) IN ('ceo', 'cfo', 'coo', 'director')
                    OR
                    pg_catalog.lower(
                        pg_catalog.btrim(COALESCE(cm.designation, ''))
                    ) IN ('ceo', 'cfo', 'coo', 'director')

                    OR

                    -- Operational roles receive access only when assigned to
                    -- the specific project.
                    (
                        proj_id IS NOT NULL
                        AND EXISTS (
                            SELECT 1
                            FROM public.project_members AS pm
                            WHERE pm.project_id = proj_id
                              AND pm.company_member_id = cm.id
                              AND (
                                    pg_catalog.lower(
                                        pg_catalog.btrim(
                                            COALESCE(cm.role, '')
                                        )
                                    ) IN (
                                        'project manager',
                                        'senior engineer',
                                        'junior engineer',
                                        'site manager',
                                        'site agent'
                                    )
                                    OR
                                    pg_catalog.lower(
                                        pg_catalog.btrim(
                                            COALESCE(cm.designation, '')
                                        )
                                    ) IN (
                                        'project manager',
                                        'senior engineer',
                                        'junior engineer',
                                        'site manager',
                                        'site agent'
                                    )
                                    OR
                                    pg_catalog.lower(
                                        pg_catalog.btrim(
                                            COALESCE(pm.project_role, '')
                                        )
                                    ) IN (
                                        'project manager',
                                        'senior engineer',
                                        'junior engineer',
                                        'site manager',
                                        'site agent'
                                    )
                                    OR
                                    pg_catalog.lower(
                                        pg_catalog.btrim(
                                            COALESCE(pm.designation, '')
                                        )
                                    ) IN (
                                        'project manager',
                                        'senior engineer',
                                        'junior engineer',
                                        'site manager',
                                        'site agent'
                                    )
                              )
                        )
                    )
              )
        );
$function$;

COMMENT ON FUNCTION public.verify_project_advisor_access(UUID, UUID)
IS 'Returns true for active accepted executives at company scope, or executives and authorised assigned operational roles at project scope. Company Admin alone does not grant Project Advisor access.';

-- SECURITY DEFINER functions must not retain Supabase's default PUBLIC access.
REVOKE ALL PRIVILEGES
ON FUNCTION public.verify_project_advisor_access(UUID, UUID)
FROM PUBLIC;

REVOKE ALL PRIVILEGES
ON FUNCTION public.verify_project_advisor_access(UUID, UUID)
FROM anon, service_role;

GRANT EXECUTE
ON FUNCTION public.verify_project_advisor_access(UUID, UUID)
TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Project Advisor state tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.project_advisor_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL
        REFERENCES public.companies(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    project_id UUID,
    created_by UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Advisor Chat',
    scope TEXT NOT NULL DEFAULT 'project',
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT project_advisor_conversations_title_check
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title))
            BETWEEN 1 AND 200
        ),

    CONSTRAINT project_advisor_conversations_scope_check
        CHECK (scope IN ('project', 'company')),

    CONSTRAINT project_advisor_conversations_scope_project_check
        CHECK (
            (scope = 'project' AND project_id IS NOT NULL)
            OR
            (scope = 'company' AND project_id IS NULL)
        ),

    CONSTRAINT project_advisor_conversations_company_project_fkey
        FOREIGN KEY (project_id, company_id)
        REFERENCES public.projects(id, company_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE public.project_advisor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL
        REFERENCES public.project_advisor_conversations(id)
        ON DELETE CASCADE,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    sources_json JSONB,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT project_advisor_messages_sender_check
        CHECK (sender IN ('user', 'assistant', 'system')),

    CONSTRAINT project_advisor_messages_content_check
        CHECK (pg_catalog.char_length(pg_catalog.btrim(content)) > 0),

    CONSTRAINT project_advisor_messages_sources_json_check
        CHECK (
            sources_json IS NULL
            OR pg_catalog.jsonb_typeof(sources_json) = 'array'
        ),

    CONSTRAINT project_advisor_messages_metadata_json_check
        CHECK (
            metadata_json IS NULL
            OR pg_catalog.jsonb_typeof(metadata_json) = 'object'
        )
);

CREATE TABLE public.project_advisor_document_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID
        REFERENCES public.project_advisor_conversations(id)
        ON DELETE CASCADE,
    company_id UUID NOT NULL
        REFERENCES public.companies(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    project_id UUID,
    created_by UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Draft',
    document_type TEXT NOT NULL DEFAULT 'report',
    content_markdown TEXT NOT NULL DEFAULT '',
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT project_advisor_document_drafts_title_check
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title))
            BETWEEN 1 AND 200
        ),

    CONSTRAINT project_advisor_document_drafts_type_check
        CHECK (
            document_type IN (
                'report',
                'letter',
                'memo',
                'contract_claim',
                'site_instruction',
                'rfi_summary',
                'progress_narrative'
            )
        ),

    CONSTRAINT project_advisor_document_drafts_metadata_json_check
        CHECK (
            metadata_json IS NULL
            OR pg_catalog.jsonb_typeof(metadata_json) = 'object'
        ),

    CONSTRAINT project_advisor_document_drafts_company_project_fkey
        FOREIGN KEY (project_id, company_id)
        REFERENCES public.projects(id, company_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

COMMENT ON TABLE public.project_advisor_conversations
IS 'Private Project Advisor conversation headers owned by individual authenticated users.';

COMMENT ON TABLE public.project_advisor_messages
IS 'Immutable Project Advisor chat messages, sources, and structured response metadata.';

COMMENT ON TABLE public.project_advisor_document_drafts
IS 'Private user-owned document drafts generated or saved from Project Advisor.';

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX project_advisor_conversations_owner_scope_idx
ON public.project_advisor_conversations
    (created_by, company_id, project_id, updated_at DESC);

CREATE INDEX project_advisor_conversations_company_project_idx
ON public.project_advisor_conversations
    (company_id, project_id);

CREATE INDEX project_advisor_messages_conversation_created_idx
ON public.project_advisor_messages
    (conversation_id, created_at, id);

CREATE INDEX project_advisor_document_drafts_owner_scope_idx
ON public.project_advisor_document_drafts
    (created_by, company_id, project_id, updated_at DESC);

CREATE INDEX project_advisor_document_drafts_conversation_idx
ON public.project_advisor_document_drafts
    (conversation_id)
WHERE conversation_id IS NOT NULL;

CREATE INDEX project_advisor_document_drafts_company_project_idx
ON public.project_advisor_document_drafts
    (company_id, project_id);

-- ---------------------------------------------------------------------------
-- 4. Integrity and lifecycle trigger functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.project_advisor_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_advisor_protect_conversation_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.scope IS DISTINCT FROM OLD.scope
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Conversation tenant, project, scope, owner, and creation timestamp are immutable.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_advisor_protect_draft_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Draft conversation, tenant, project, owner, and creation timestamp are immutable.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_advisor_validate_draft_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    parent_company_id UUID;
    parent_project_id UUID;
    parent_created_by UUID;
BEGIN
    IF NEW.conversation_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT
        conversation.company_id,
        conversation.project_id,
        conversation.created_by
    INTO
        parent_company_id,
        parent_project_id,
        parent_created_by
    FROM public.project_advisor_conversations AS conversation
    WHERE conversation.id = NEW.conversation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'The selected Project Advisor conversation does not exist.'
            USING ERRCODE = '23503';
    END IF;

    IF NEW.company_id IS DISTINCT FROM parent_company_id
       OR NEW.project_id IS DISTINCT FROM parent_project_id
       OR NEW.created_by IS DISTINCT FROM parent_created_by
    THEN
        RAISE EXCEPTION
            'A Project Advisor draft must match its conversation company, project, and owner.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_advisor_touch_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    UPDATE public.project_advisor_conversations
    SET updated_at = pg_catalog.now()
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$function$;

-- Trigger functions are internal implementation details, not public RPCs.
REVOKE ALL PRIVILEGES
ON FUNCTION public.project_advisor_set_updated_at()
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.project_advisor_protect_conversation_identity()
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.project_advisor_protect_draft_identity()
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.project_advisor_validate_draft_context()
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.project_advisor_touch_conversation()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER project_advisor_conversations_10_protect_identity
BEFORE UPDATE ON public.project_advisor_conversations
FOR EACH ROW
EXECUTE FUNCTION public.project_advisor_protect_conversation_identity();

CREATE TRIGGER project_advisor_conversations_90_set_updated_at
BEFORE UPDATE ON public.project_advisor_conversations
FOR EACH ROW
EXECUTE FUNCTION public.project_advisor_set_updated_at();

CREATE TRIGGER project_advisor_document_drafts_10_protect_identity
BEFORE UPDATE ON public.project_advisor_document_drafts
FOR EACH ROW
EXECUTE FUNCTION public.project_advisor_protect_draft_identity();

CREATE TRIGGER project_advisor_document_drafts_20_validate_context
BEFORE INSERT OR UPDATE ON public.project_advisor_document_drafts
FOR EACH ROW
EXECUTE FUNCTION public.project_advisor_validate_draft_context();

CREATE TRIGGER project_advisor_document_drafts_90_set_updated_at
BEFORE UPDATE ON public.project_advisor_document_drafts
FOR EACH ROW
EXECUTE FUNCTION public.project_advisor_set_updated_at();

CREATE TRIGGER project_advisor_messages_90_touch_conversation
AFTER INSERT ON public.project_advisor_messages
FOR EACH ROW
EXECUTE FUNCTION public.project_advisor_touch_conversation();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_advisor_conversations
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_advisor_conversations
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_advisor_messages
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_advisor_messages
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_advisor_document_drafts
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_advisor_document_drafts
    FORCE ROW LEVEL SECURITY;

-- Conversations remain private to their creator. Current role access is
-- rechecked on every operation; there is no created_by-only tenant bypass.

CREATE POLICY project_advisor_conversations_select_own_authorised
ON public.project_advisor_conversations
FOR SELECT
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

CREATE POLICY project_advisor_conversations_insert_own_authorised
ON public.project_advisor_conversations
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

CREATE POLICY project_advisor_conversations_update_own_authorised
ON public.project_advisor_conversations
FOR UPDATE
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
)
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

CREATE POLICY project_advisor_conversations_delete_own_authorised
ON public.project_advisor_conversations
FOR DELETE
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

-- Messages are immutable. They may be read or inserted only through a private,
-- currently authorised conversation.

CREATE POLICY project_advisor_messages_select_via_own_conversation
ON public.project_advisor_messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.project_advisor_conversations AS conversation
        WHERE conversation.id = project_advisor_messages.conversation_id
          AND conversation.created_by = (SELECT auth.uid())
          AND public.verify_project_advisor_access(
                conversation.company_id,
                conversation.project_id
          )
    )
);

CREATE POLICY project_advisor_messages_insert_via_own_conversation
ON public.project_advisor_messages
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.project_advisor_conversations AS conversation
        WHERE conversation.id = project_advisor_messages.conversation_id
          AND conversation.created_by = (SELECT auth.uid())
          AND public.verify_project_advisor_access(
                conversation.company_id,
                conversation.project_id
          )
    )
);

-- Drafts are private to their creator and are re-authorised by company/project.

CREATE POLICY project_advisor_document_drafts_select_own_authorised
ON public.project_advisor_document_drafts
FOR SELECT
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

CREATE POLICY project_advisor_document_drafts_insert_own_authorised
ON public.project_advisor_document_drafts
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

CREATE POLICY project_advisor_document_drafts_update_own_authorised
ON public.project_advisor_document_drafts
FOR UPDATE
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
)
WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

CREATE POLICY project_advisor_document_drafts_delete_own_authorised
ON public.project_advisor_document_drafts
FOR DELETE
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    AND public.verify_project_advisor_access(company_id, project_id)
);

-- ---------------------------------------------------------------------------
-- 6. Explicit Data API grants
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES
ON TABLE
    public.project_advisor_conversations,
    public.project_advisor_messages,
    public.project_advisor_document_drafts
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.project_advisor_conversations
TO authenticated;

GRANT SELECT, INSERT
ON TABLE public.project_advisor_messages
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.project_advisor_document_drafts
TO authenticated;

-- Supabase's server-side service role keeps administrative access. The active
-- Project Advisor Edge Function should still use the caller's JWT client.
GRANT ALL PRIVILEGES
ON TABLE
    public.project_advisor_conversations,
    public.project_advisor_messages,
    public.project_advisor_document_drafts
TO service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- 7. Read-only installation result
-- ---------------------------------------------------------------------------

WITH advisor_rls AS (
    SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
          'project_advisor_conversations',
          'project_advisor_messages',
          'project_advisor_document_drafts'
      )
),
advisor_policy_count AS (
    SELECT pg_catalog.count(*) AS policy_count
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
          'project_advisor_conversations',
          'project_advisor_messages',
          'project_advisor_document_drafts'
      )
)
SELECT pg_catalog.jsonb_pretty(
    pg_catalog.jsonb_build_object(
        'status',
        CASE
            WHEN (SELECT pg_catalog.count(*) FROM advisor_rls) = 3
             AND (SELECT pg_catalog.bool_and(rls_enabled AND rls_forced) FROM advisor_rls)
             AND (SELECT policy_count FROM advisor_policy_count) = 10
             AND pg_catalog.has_function_privilege(
                    'authenticated',
                    'public.verify_project_advisor_access(uuid,uuid)',
                    'EXECUTE'
                 )
             AND NOT pg_catalog.has_function_privilege(
                    'anon',
                    'public.verify_project_advisor_access(uuid,uuid)',
                    'EXECUTE'
                 )
            THEN 'PASS'
            ELSE 'REVIEW REQUIRED'
        END,
        'tables',
        (
            SELECT pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'table', table_name,
                    'rls_enabled', rls_enabled,
                    'rls_forced', rls_forced
                )
                ORDER BY table_name
            )
            FROM advisor_rls
        ),
        'installed_policy_count',
        (SELECT policy_count FROM advisor_policy_count),
        'expected_policy_count',
        10,
        'authenticated_rpc_execute',
        pg_catalog.has_function_privilege(
            'authenticated',
            'public.verify_project_advisor_access(uuid,uuid)',
            'EXECUTE'
        ),
        'anon_rpc_execute',
        pg_catalog.has_function_privilege(
            'anon',
            'public.verify_project_advisor_access(uuid,uuid)',
            'EXECUTE'
        ),
        'messages_are_immutable_to_authenticated',
        NOT pg_catalog.has_table_privilege(
            'authenticated',
            'public.project_advisor_messages',
            'UPDATE'
        )
        AND NOT pg_catalog.has_table_privilege(
            'authenticated',
            'public.project_advisor_messages',
            'DELETE'
        )
    )
) AS project_advisor_installation_check;
