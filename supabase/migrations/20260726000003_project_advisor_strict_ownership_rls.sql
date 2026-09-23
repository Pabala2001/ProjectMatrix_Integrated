-- Migration: 20260726000003_project_advisor_strict_ownership_rls.sql
-- Description: Enforce strict user-level ownership on project advisor conversations, messages, and drafts.

-- Drop existing broader policies on project_advisor_conversations
DROP POLICY IF EXISTS "Users can view advisor conversations in accessible companies" ON public.project_advisor_conversations;
DROP POLICY IF EXISTS "Users can insert advisor conversations in accessible companies" ON public.project_advisor_conversations;
DROP POLICY IF EXISTS "Users can update advisor conversations in accessible companies" ON public.project_advisor_conversations;
DROP POLICY IF EXISTS "Users can delete advisor conversations created by themselves or in their companies" ON public.project_advisor_conversations;

-- Recreate strict user-ownership policies for project_advisor_conversations
CREATE POLICY "Users can view own advisor conversations"
ON public.project_advisor_conversations
FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can insert own advisor conversations"
ON public.project_advisor_conversations
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can update own advisor conversations"
ON public.project_advisor_conversations
FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can delete own advisor conversations"
ON public.project_advisor_conversations
FOR DELETE
TO authenticated
USING (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

-- Revoke execution of verify_membership_access from PUBLIC and anon, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.verify_membership_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_membership_access(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view document drafts in accessible companies" ON public.project_advisor_document_drafts;
DROP POLICY IF EXISTS "Users can insert document drafts in accessible companies" ON public.project_advisor_document_drafts;
DROP POLICY IF EXISTS "Users can update document drafts in accessible companies" ON public.project_advisor_document_drafts;
DROP POLICY IF EXISTS "Users can delete document drafts in accessible companies" ON public.project_advisor_document_drafts;

-- Recreate strict user-ownership policies for project_advisor_document_drafts
CREATE POLICY "Users can view own document drafts"
ON public.project_advisor_document_drafts
FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can insert own document drafts"
ON public.project_advisor_document_drafts
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can update own document drafts"
ON public.project_advisor_document_drafts
FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can delete own document drafts"
ON public.project_advisor_document_drafts
FOR DELETE
TO authenticated
USING (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    )
);
