-- Automatic recovery of genuine Paystack subscription webhook deliveries.
-- No payment creation, entitlement changes or forged webhook payloads.
BEGIN;
CREATE TABLE public.billing_webhook_recovery_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  scheduler_token text NOT NULL DEFAULT (gen_random_uuid()::text || gen_random_uuid()::text),
  enabled boolean NOT NULL DEFAULT false,
  run_id uuid,
  lease_until timestamptz,
  cursors jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_error text,
  last_summary jsonb
);
INSERT INTO public.billing_webhook_recovery_control(singleton) VALUES (true);
CREATE TABLE public.billing_webhook_recovery_events (
  environment text NOT NULL CHECK (environment IN ('test','live')),
  event_id text NOT NULL CHECK (event_id ~ '^[a-fA-F0-9]{24}$'),
  event_type text NOT NULL CHECK (event_type IN ('subscription.create','subscription.not_renew')),
  resource_id text NOT NULL CHECK (resource_id ~ '^[1-9][0-9]*$'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','delivered','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,event_id)
);
CREATE INDEX billing_webhook_recovery_due ON public.billing_webhook_recovery_events(environment,event_type,next_attempt_at)
  WHERE state IN ('pending','accepted');
ALTER TABLE public.billing_webhook_recovery_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_recovery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_webhook_recovery_control, public.billing_webhook_recovery_events FROM PUBLIC, anon, authenticated, service_role;

-- Only the scheduler's secret can acquire the worker lease. A timed-out worker
-- loses its lease; all subsequent writes from that worker are rejected.
CREATE FUNCTION public.begin_paystack_webhook_recovery(p_token text, p_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.billing_webhook_recovery_control%ROWTYPE; v_run uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.billing_webhook_recovery_control WHERE singleton FOR UPDATE;
  IF p_token IS NULL OR p_token IS DISTINCT FROM c.scheduler_token THEN RAISE EXCEPTION 'Unauthorized scheduler' USING ERRCODE='28000'; END IF;
  IF p_environment IS NULL OR p_environment NOT IN ('test','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
  IF NOT c.enabled OR c.lease_until > clock_timestamp() THEN RETURN jsonb_build_object('acquired',false); END IF;
  v_run := gen_random_uuid();
  UPDATE public.billing_webhook_recovery_control SET run_id=v_run, lease_until=clock_timestamp()+interval '2 minutes', last_started_at=clock_timestamp() WHERE singleton;
  RETURN jsonb_build_object('acquired',true,'run_id',v_run,'cursors',COALESCE(c.cursors->p_environment,'{}'::jsonb));
END $$;

CREATE FUNCTION public.update_paystack_webhook_recovery(p_run_id uuid, p_environment text, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.billing_webhook_recovery_control%ROWTYPE; item jsonb; result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.billing_webhook_recovery_control WHERE singleton FOR UPDATE;
  IF p_run_id IS NULL OR c.run_id IS DISTINCT FROM p_run_id OR c.lease_until <= clock_timestamp() OR NOT c.enabled THEN
    RAISE EXCEPTION 'Recovery lease expired' USING ERRCODE='40001';
  END IF;
  IF p_environment IS NULL OR p_environment NOT IN ('test','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
  IF p_action='discover' THEN
    IF jsonb_typeof(p_data->'events') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'events')>100 THEN RAISE EXCEPTION 'Invalid discovery batch'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_data->'events') LOOP
      INSERT INTO public.billing_webhook_recovery_events(environment,event_id,event_type,resource_id)
      VALUES(p_environment,item->>'event_id',item->>'event_type',item->>'resource_id')
      ON CONFLICT(environment,event_id) DO NOTHING;
    END LOOP;
    UPDATE public.billing_webhook_recovery_control SET cursors=jsonb_set(cursors,ARRAY[p_environment],p_data->'cursors',true) WHERE singleton;
    RETURN '{}'::jsonb;
  ELSIF p_action='claim' THEN
    -- Four of each type per run prevents a persistently broken creation event
    -- from starving unrelated cancellations. Creation is returned first.
    WITH ranked AS (
      SELECT event_id, event_type, row_number() OVER(PARTITION BY event_type ORDER BY next_attempt_at,discovered_at) AS rn
      FROM public.billing_webhook_recovery_events
      WHERE environment=p_environment AND state IN ('pending','accepted') AND next_attempt_at<=clock_timestamp()
    ), updated AS (
      UPDATE public.billing_webhook_recovery_events e SET attempts=e.attempts+1,
        next_attempt_at=clock_timestamp()+CASE WHEN e.attempts<5 THEN interval '1 minute' ELSE interval '5 minutes' END,
        updated_at=clock_timestamp()
      FROM ranked r WHERE e.environment=p_environment AND e.event_id=r.event_id AND r.rn<=4
      RETURNING e.event_id,e.event_type,e.resource_id,e.attempts
    ) SELECT COALESCE(jsonb_agg(to_jsonb(updated) ORDER BY event_type,event_id),'[]'::jsonb) INTO result FROM updated;
    RETURN result;
  ELSIF p_action='result' THEN
    IF (p_data->>'state') IS NULL OR p_data->>'state' NOT IN ('pending','accepted','delivered','skipped') THEN RAISE EXCEPTION 'Invalid result'; END IF;
    UPDATE public.billing_webhook_recovery_events SET state=p_data->>'state',last_result=left(p_data->>'result',120),updated_at=clock_timestamp()
    WHERE environment=p_environment AND event_id=p_data->>'event_id' AND state IN ('pending','accepted');
    RETURN '{}'::jsonb;
  ELSIF p_action='finish' THEN
    UPDATE public.billing_webhook_recovery_control SET lease_until=NULL,run_id=NULL,last_finished_at=clock_timestamp(),
      last_error=left(p_data->>'error',120),last_summary=p_data->'summary' WHERE singleton;
    RETURN '{}'::jsonb;
  END IF;
  RAISE EXCEPTION 'Invalid recovery action';
END $$;
REVOKE ALL ON FUNCTION public.begin_paystack_webhook_recovery(text,text), public.update_paystack_webhook_recovery(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_paystack_webhook_recovery(text,text), public.update_paystack_webhook_recovery(uuid,text,text,jsonb) TO service_role;
COMMIT;
