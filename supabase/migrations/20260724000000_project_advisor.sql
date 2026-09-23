-- Migration: 20260724000000_project_advisor.sql
-- Description: Project Advisor Gemini Management Copilot schema (conversations, messages, drafts)

-- 1. Create project_advisor_conversations
CREATE TABLE IF NOT EXISTS public.project_advisor_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('project', 'company', 'all')) DEFAULT 'project',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create project_advisor_messages
CREATE TABLE IF NOT EXISTS public.project_advisor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.project_advisor_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources_json JSONB,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create project_advisor_document_drafts
CREATE TABLE IF NOT EXISTS public.project_advisor_document_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.project_advisor_conversations(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('report', 'letter', 'memo', 'contract_claim', 'site_instruction', 'rfi_summary', 'progress_narrative')),
    content_markdown TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_advisor_conv_company ON public.project_advisor_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_advisor_conv_project ON public.project_advisor_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_advisor_conv_created_by ON public.project_advisor_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_advisor_msg_conv ON public.project_advisor_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_advisor_drafts_company ON public.project_advisor_document_drafts(company_id);
CREATE INDEX IF NOT EXISTS idx_advisor_drafts_project ON public.project_advisor_document_drafts(project_id);

-- Enable RLS
ALTER TABLE public.project_advisor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_advisor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_advisor_document_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_advisor_conversations
CREATE POLICY "Users can view advisor conversations in accessible companies"
ON public.project_advisor_conversations
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

CREATE POLICY "Users can insert advisor conversations in accessible companies"
ON public.project_advisor_conversations
FOR INSERT
TO authenticated
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

CREATE POLICY "Users can update advisor conversations in accessible companies"
ON public.project_advisor_conversations
FOR UPDATE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

CREATE POLICY "Users can delete advisor conversations created by themselves or in their companies"
ON public.project_advisor_conversations
FOR DELETE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

-- RLS Policies for project_advisor_messages
CREATE POLICY "Users can view messages of accessible conversations"
ON public.project_advisor_messages
FOR SELECT
TO authenticated
USING (
    conversation_id IN (
        SELECT id FROM public.project_advisor_conversations
    )
);

CREATE POLICY "Users can insert messages into accessible conversations"
ON public.project_advisor_messages
FOR INSERT
TO authenticated
WITH CHECK (
    conversation_id IN (
        SELECT id FROM public.project_advisor_conversations
    )
);

CREATE POLICY "Users can update messages of accessible conversations"
ON public.project_advisor_messages
FOR UPDATE
TO authenticated
USING (
    conversation_id IN (
        SELECT id FROM public.project_advisor_conversations
    )
);

CREATE POLICY "Users can delete messages of accessible conversations"
ON public.project_advisor_messages
FOR DELETE
TO authenticated
USING (
    conversation_id IN (
        SELECT id FROM public.project_advisor_conversations
    )
);

-- RLS Policies for project_advisor_document_drafts
CREATE POLICY "Users can view document drafts in accessible companies"
ON public.project_advisor_document_drafts
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

CREATE POLICY "Users can insert document drafts in accessible companies"
ON public.project_advisor_document_drafts
FOR INSERT
TO authenticated
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

CREATE POLICY "Users can update document drafts in accessible companies"
ON public.project_advisor_document_drafts
FOR UPDATE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);

CREATE POLICY "Users can delete document drafts in accessible companies"
ON public.project_advisor_document_drafts
FOR DELETE
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE profile_id = auth.uid() AND is_active = true
    ) OR created_by = auth.uid()
);
