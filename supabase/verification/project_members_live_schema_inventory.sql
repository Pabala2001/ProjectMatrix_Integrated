-- =============================================================================
-- Live Schema Inventory: public.project_members
-- Purpose: Safely extract complete, authoritative schema definitions for
--          public.project_members directly from PostgreSQL system catalogs.
-- Read-Only: Zero DDL, zero DML, zero temporary tables, zero business row access.
-- Output: A single exportable JSON object containing all schema metadata.
-- =============================================================================

WITH target_table AS (
  SELECT
    c.oid AS table_oid,
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relkind AS relkind,
    pg_catalog.pg_get_userbyid(c.relowner) AS table_owner,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    c.relpersistence AS persistence,
    pg_catalog.obj_description(c.oid, 'pg_class') AS table_comment
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'project_members'
    AND c.relkind IN ('r', 'p')
),

column_inventory AS (
  SELECT
    a.attnum AS ordinal_position,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS exact_data_type,
    NOT a.attnotnull AS is_nullable,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid, true) AS default_expression,
    CASE a.attidentity
      WHEN 'a' THEN 'ALWAYS'
      WHEN 'd' THEN 'BY DEFAULT'
      ELSE 'NO'
    END AS is_identity,
    CASE a.attgenerated
      WHEN 's' THEN 'STORED'
      ELSE 'NEVER'
    END AS is_generated,
    coll.collname AS collation_name,
    pg_catalog.col_description(a.attrelid, a.attnum) AS column_comment
  FROM pg_catalog.pg_attribute a
  JOIN target_table tt ON tt.table_oid = a.attrelid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  LEFT JOIN pg_catalog.pg_collation coll ON coll.oid = a.attcollation AND a.attcollation <> 0
  WHERE a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum
),

constraint_inventory AS (
  SELECT
    con.conname AS constraint_name,
    CASE con.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'c' THEN 'CHECK'
      WHEN 't' THEN 'TRIGGER'
      WHEN 'x' THEN 'EXCLUSION'
      ELSE con.contype::text
    END AS constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS canonical_definition,
    con.condeferrable AS is_deferrable,
    con.condeferred AS is_deferred,
    con.convalidated AS is_validated,
    pg_catalog.obj_description(con.oid, 'pg_constraint') AS constraint_comment
  FROM pg_catalog.pg_constraint con
  JOIN target_table tt ON tt.table_oid = con.conrelid
  ORDER BY
    CASE con.contype
      WHEN 'p' THEN 1
      WHEN 'u' THEN 2
      WHEN 'f' THEN 3
      WHEN 'c' THEN 4
      ELSE 5
    END,
    con.conname
),

index_inventory AS (
  SELECT
    ic.relname AS index_name,
    i.indisunique AS is_unique,
    i.indisprimary AS is_primary,
    am.amname AS access_method,
    pg_catalog.pg_get_indexdef(i.indexrelid, 0, true) AS canonical_definition,
    pg_catalog.obj_description(i.indexrelid, 'pg_class') AS index_comment
  FROM pg_catalog.pg_index i
  JOIN target_table tt ON tt.table_oid = i.indrelid
  JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_catalog.pg_am am ON am.oid = ic.relam
  ORDER BY i.indisprimary DESC, ic.relname
),

trigger_inventory AS (
  SELECT
    t.tgname AS trigger_name,
    CASE
      WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE'
      WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
      ELSE 'AFTER'
    END AS action_timing,
    ARRAY_TO_STRING(ARRAY[
      CASE WHEN (t.tgtype & 4) <> 0 THEN 'INSERT' END,
      CASE WHEN (t.tgtype & 8) <> 0 THEN 'DELETE' END,
      CASE WHEN (t.tgtype & 16) <> 0 THEN 'UPDATE' END,
      CASE WHEN (t.tgtype & 32) <> 0 THEN 'TRUNCATE' END
    ], ' OR ') AS event_manipulation,
    CASE WHEN (t.tgtype & 1) <> 0 THEN 'ROW' ELSE 'STATEMENT' END AS action_orientation,
    pn.nspname AS function_schema,
    p.proname AS function_name,
    CASE t.tgenabled
      WHEN 'O' THEN 'ORIGIN'
      WHEN 'D' THEN 'DISABLED'
      WHEN 'R' THEN 'REPLICA'
      WHEN 'A' THEN 'ALWAYS'
      ELSE t.tgenabled::text
    END AS status,
    pg_catalog.pg_get_triggerdef(t.oid, true) AS canonical_definition,
    pg_catalog.obj_description(t.oid, 'pg_trigger') AS trigger_comment
  FROM pg_catalog.pg_trigger t
  JOIN target_table tt ON tt.table_oid = t.tgrelid
  LEFT JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
  LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
  WHERE NOT t.tgisinternal
  ORDER BY t.tgname
),

policy_inventory AS (
  SELECT
    pol.polname AS policy_name,
    CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
      ELSE pol.polcmd::text
    END AS command,
    CASE pol.polpermissive
      WHEN true THEN 'PERMISSIVE'
      ELSE 'RESTRICTIVE'
    END AS policy_type,
    CASE
      WHEN pol.polroles = '{0}' THEN ARRAY['PUBLIC']
      ELSE ARRAY(
        SELECT rolname
        FROM pg_catalog.pg_roles
        WHERE oid = ANY(pol.polroles)
      )
    END AS roles,
    pg_catalog.pg_get_expr(pol.polqual, pol.polrelid, true) AS using_expression,
    pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid, true) AS with_check_expression,
    pg_catalog.obj_description(pol.oid, 'pg_policy') AS policy_comment
  FROM pg_catalog.pg_policy pol
  JOIN target_table tt ON tt.table_oid = pol.polrelid
  ORDER BY pol.polname
),

privilege_inventory AS (
  SELECT
    grantee,
    privilege_type,
    is_grantable
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'project_members'
  ORDER BY grantee, privilege_type
),

outbound_foreign_keys AS (
  SELECT
    con.conname AS constraint_name,
    fn.nspname AS target_schema,
    fc.relname AS target_table,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS canonical_definition
  FROM pg_catalog.pg_constraint con
  JOIN target_table tt ON tt.table_oid = con.conrelid
  JOIN pg_catalog.pg_class fc ON fc.oid = con.confrelid
  JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
  WHERE con.contype = 'f'
  ORDER BY con.conname
),

inbound_foreign_keys AS (
  SELECT
    con.conname AS constraint_name,
    src_ns.nspname AS referencing_schema,
    src_cl.relname AS referencing_table,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS canonical_definition
  FROM pg_catalog.pg_constraint con
  JOIN target_table tt ON tt.table_oid = con.confrelid
  JOIN pg_catalog.pg_class src_cl ON src_cl.oid = con.conrelid
  JOIN pg_catalog.pg_namespace src_ns ON src_ns.oid = src_cl.relnamespace
  WHERE con.contype = 'f'
  ORDER BY src_ns.nspname, src_cl.relname, con.conname
)

SELECT
  jsonb_pretty(
    jsonb_build_object(
      'inventory_target', 'public.project_members',
      'generated_at', pg_catalog.clock_timestamp(),
      'table_exists', (EXISTS (SELECT 1 FROM target_table)),
      'table_metadata', (
        SELECT jsonb_build_object(
          'schema_name', tt.schema_name,
          'table_name', tt.table_name,
          'relation_type', CASE tt.relkind
            WHEN 'r' THEN 'ordinary table'
            WHEN 'p' THEN 'partitioned table'
            ELSE tt.relkind::text
          END,
          'table_owner', tt.table_owner,
          'persistence', CASE tt.persistence
            WHEN 'p' THEN 'permanent'
            WHEN 'u' THEN 'unlogged'
            WHEN 't' THEN 'temporary'
            ELSE tt.persistence::text
          END,
          'row_level_security_enabled', tt.rls_enabled,
          'force_row_level_security', tt.rls_forced,
          'comment', tt.table_comment
        )
        FROM target_table tt
      ),
      'columns', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'ordinal_position', ci.ordinal_position,
              'column_name', ci.column_name,
              'exact_data_type', ci.exact_data_type,
              'is_nullable', ci.is_nullable,
              'default_expression', ci.default_expression,
              'is_identity', ci.is_identity,
              'is_generated', ci.is_generated,
              'collation', ci.collation_name,
              'comment', ci.column_comment
            )
          )
          FROM column_inventory ci
        ),
        '[]'::jsonb
      ),
      'constraints', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'constraint_name', csi.constraint_name,
              'constraint_type', csi.constraint_type,
              'canonical_definition', csi.canonical_definition,
              'is_deferrable', csi.is_deferrable,
              'is_deferred', csi.is_deferred,
              'is_validated', csi.is_validated,
              'comment', csi.constraint_comment
            )
          )
          FROM constraint_inventory csi
        ),
        '[]'::jsonb
      ),
      'indexes', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'index_name', ii.index_name,
              'is_unique', ii.is_unique,
              'is_primary', ii.is_primary,
              'access_method', ii.access_method,
              'canonical_definition', ii.canonical_definition,
              'comment', ii.index_comment
            )
          )
          FROM index_inventory ii
        ),
        '[]'::jsonb
      ),
      'triggers', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'trigger_name', ti.trigger_name,
              'action_timing', ti.action_timing,
              'event_manipulation', ti.event_manipulation,
              'action_orientation', ti.action_orientation,
              'function_schema', ti.function_schema,
              'function_name', ti.function_name,
              'status', ti.status,
              'canonical_definition', ti.canonical_definition,
              'comment', ti.trigger_comment
            )
          )
          FROM trigger_inventory ti
        ),
        '[]'::jsonb
      ),
      'policies', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'policy_name', pi.policy_name,
              'command', pi.command,
              'policy_type', pi.policy_type,
              'roles', pi.roles,
              'using_expression', pi.using_expression,
              'with_check_expression', pi.with_check_expression,
              'comment', pi.policy_comment
            )
          )
          FROM policy_inventory pi
        ),
        '[]'::jsonb
      ),
      'privileges', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'grantee', prv.grantee,
              'privilege_type', prv.privilege_type,
              'is_grantable', prv.is_grantable
            )
          )
          FROM privilege_inventory prv
        ),
        '[]'::jsonb
      ),
      'foreign_key_relationships', jsonb_build_object(
        'outbound_parent_tables', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'constraint_name', ob.constraint_name,
                'target_schema', ob.target_schema,
                'target_table', ob.target_table,
                'canonical_definition', ob.canonical_definition
              )
            )
            FROM outbound_foreign_keys ob
          ),
          '[]'::jsonb
        ),
        'inbound_referencing_tables', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'constraint_name', ib.constraint_name,
                'referencing_schema', ib.referencing_schema,
                'referencing_table', ib.referencing_table,
                'canonical_definition', ib.canonical_definition
              )
            )
            FROM inbound_foreign_keys ib
          ),
          '[]'::jsonb
        )
      )
    )
  ) AS live_schema_inventory;
