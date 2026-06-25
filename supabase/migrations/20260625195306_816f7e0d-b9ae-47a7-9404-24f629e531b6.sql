-- Drop existing partial schema
DROP TABLE IF EXISTS public.profiles, public.user_roles, public.teams, public.team_members, public.demand_attachments, public.demand_templates, public.demand_requests, public.user_preferences, public.demand_statuses, public.services, public.demands, public.demand_interactions, public.demand_assignees, public.team_join_requests, public.notifications, public.demand_subtasks CASCADE;
DROP TYPE IF EXISTS public.app_role, public.team_role CASCADE;

CREATE TYPE public.adjustment_type AS ENUM ('none', 'internal', 'external');
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.note_share_permission AS ENUM ('viewer', 'editor');
CREATE TYPE public.team_role AS ENUM ('admin', 'moderator', 'requester', 'executor');

CREATE TABLE public.api_keys (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, name text NOT NULL, key_hash text NOT NULL, key_prefix text NOT NULL, permissions jsonb DEFAULT '{"boards.read": true, "demands.read": true, "demands.write": true, "statuses.read": true}'::jsonb NOT NULL, is_active boolean DEFAULT true NOT NULL, last_used_at timestamp with time zone, expires_at timestamp with time zone, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.api_keys ADD PRIMARY KEY (id);
CREATE INDEX idx_api_keys_is_active ON public.api_keys(is_active);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_team_id ON public.api_keys(team_id);

CREATE TABLE public.api_logs (id uuid DEFAULT gen_random_uuid() NOT NULL, api_key_id uuid NOT NULL, method text NOT NULL, path text NOT NULL, status_code integer NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.api_logs ADD PRIMARY KEY (id);
CREATE INDEX idx_api_logs_api_key_id ON public.api_logs(api_key_id);
CREATE INDEX idx_api_logs_created_at ON public.api_logs(created_at DESC);

CREATE TABLE public.board_approval_notify_settings (id uuid DEFAULT gen_random_uuid() NOT NULL, board_id uuid NOT NULL, approval_type text NOT NULL, recipient_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL, include_creator boolean DEFAULT true NOT NULL, mode text DEFAULT 'manual'::text NOT NULL, updated_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.board_approval_notify_settings ADD PRIMARY KEY (id);
ALTER TABLE public.board_approval_notify_settings ADD UNIQUE (board_id, approval_type);
ALTER TABLE public.board_approval_notify_settings ADD CHECK (approval_type IN ('internal','external'));
ALTER TABLE public.board_approval_notify_settings ADD CHECK (mode IN ('all','manual'));
CREATE INDEX idx_bans_board ON public.board_approval_notify_settings(board_id);

CREATE TABLE public.board_members (id uuid DEFAULT gen_random_uuid() NOT NULL, board_id uuid NOT NULL, user_id uuid NOT NULL, role team_role DEFAULT 'requester'::team_role NOT NULL, added_by uuid, joined_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.board_members ADD PRIMARY KEY (id);
ALTER TABLE public.board_members ADD UNIQUE (board_id, user_id);
CREATE INDEX idx_board_members_board_id ON public.board_members(board_id);
CREATE INDEX idx_board_members_user_id ON public.board_members(user_id);

CREATE TABLE public.board_services (id uuid DEFAULT gen_random_uuid() NOT NULL, board_id uuid NOT NULL, service_id uuid NOT NULL, monthly_limit integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.board_services ADD PRIMARY KEY (id);
ALTER TABLE public.board_services ADD UNIQUE (board_id, service_id);
CREATE INDEX idx_board_services_board_id ON public.board_services(board_id);
CREATE INDEX idx_board_services_service_id ON public.board_services(service_id);

CREATE TABLE public.board_statuses (id uuid DEFAULT gen_random_uuid() NOT NULL, board_id uuid NOT NULL, status_id uuid NOT NULL, "position" integer DEFAULT 0 NOT NULL, is_active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, adjustment_type adjustment_type DEFAULT 'none'::adjustment_type, visible_to_roles text[]);
ALTER TABLE public.board_statuses ADD PRIMARY KEY (id);
ALTER TABLE public.board_statuses ADD UNIQUE (board_id, status_id);

CREATE TABLE public.board_summary_history (id uuid DEFAULT gen_random_uuid() NOT NULL, board_id uuid NOT NULL, created_by uuid NOT NULL, summary_text text NOT NULL, analytics_data jsonb NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.board_summary_history ADD PRIMARY KEY (id);
CREATE INDEX idx_bsh_board_id ON public.board_summary_history(board_id);

CREATE TABLE public.board_summary_share_tokens (id uuid DEFAULT gen_random_uuid() NOT NULL, summary_id uuid NOT NULL, token varchar(64) NOT NULL, created_by uuid NOT NULL, expires_at timestamp with time zone, is_active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.board_summary_share_tokens ADD PRIMARY KEY (id);
ALTER TABLE public.board_summary_share_tokens ADD UNIQUE (token);
CREATE INDEX idx_bsst_summary_id ON public.board_summary_share_tokens(summary_id);
CREATE INDEX idx_bsst_token ON public.board_summary_share_tokens(token);

CREATE TABLE public.board_whatsapp_keywords (id uuid DEFAULT gen_random_uuid() NOT NULL, board_id uuid NOT NULL, keyword text NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.board_whatsapp_keywords ADD PRIMARY KEY (id);
CREATE INDEX bwk_board_idx ON public.board_whatsapp_keywords(board_id);
CREATE UNIQUE INDEX bwk_keyword_unique ON public.board_whatsapp_keywords(lower(keyword));

CREATE TABLE public.boards (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, name text NOT NULL, description text, is_default boolean DEFAULT false, monthly_demand_limit integer DEFAULT 0, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, whatsapp_enabled boolean DEFAULT false NOT NULL);
ALTER TABLE public.boards ADD PRIMARY KEY (id);
CREATE INDEX idx_boards_team_id ON public.boards(team_id);

CREATE TABLE public.contracts (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, original_content text, processed_content text, file_url text, file_name text, status text DEFAULT 'pending'::text NOT NULL, uploaded_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.contracts ADD PRIMARY KEY (id);
ALTER TABLE public.contracts ADD CHECK (status IN ('pending','processing','completed','error'));

CREATE TABLE public.coupon_redemptions (id uuid DEFAULT gen_random_uuid() NOT NULL, coupon_id uuid NOT NULL, team_id uuid NOT NULL, redeemed_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.coupon_redemptions ADD PRIMARY KEY (id);
ALTER TABLE public.coupon_redemptions ADD UNIQUE (coupon_id, team_id);

CREATE TABLE public.demand_approval_notify_settings (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, approval_type text NOT NULL, mode text DEFAULT 'all'::text NOT NULL, recipient_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL, include_creator boolean DEFAULT true NOT NULL, created_by uuid, updated_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.demand_approval_notify_settings ADD PRIMARY KEY (id);
ALTER TABLE public.demand_approval_notify_settings ADD UNIQUE (demand_id, approval_type);
ALTER TABLE public.demand_approval_notify_settings ADD CHECK (approval_type IN ('internal','external'));
ALTER TABLE public.demand_approval_notify_settings ADD CHECK (mode IN ('all','manual'));
CREATE INDEX idx_dans_demand ON public.demand_approval_notify_settings(demand_id);

CREATE TABLE public.demand_assignees (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, user_id uuid NOT NULL, assigned_at timestamp with time zone DEFAULT now(), is_primary boolean DEFAULT false NOT NULL);
ALTER TABLE public.demand_assignees ADD PRIMARY KEY (id);
ALTER TABLE public.demand_assignees ADD UNIQUE (demand_id, user_id);
CREATE UNIQUE INDEX da_one_primary_per_demand ON public.demand_assignees(demand_id) WHERE is_primary = true;

CREATE TABLE public.demand_attachments (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, file_name text NOT NULL, file_path text NOT NULL, file_type text NOT NULL, file_size integer NOT NULL, uploaded_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, interaction_id uuid);
ALTER TABLE public.demand_attachments ADD PRIMARY KEY (id);
CREATE INDEX idx_da_interaction_id ON public.demand_attachments(interaction_id);

CREATE TABLE public.demand_dependencies (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, depends_on_demand_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.demand_dependencies ADD PRIMARY KEY (id);
ALTER TABLE public.demand_dependencies ADD UNIQUE (demand_id, depends_on_demand_id);
ALTER TABLE public.demand_dependencies ADD CHECK (demand_id <> depends_on_demand_id);

CREATE TABLE public.demand_interactions (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, demand_id uuid NOT NULL, user_id uuid NOT NULL, interaction_type text NOT NULL, content text, metadata jsonb, created_at timestamp with time zone DEFAULT now() NOT NULL, channel text DEFAULT 'general'::text NOT NULL);
ALTER TABLE public.demand_interactions ADD PRIMARY KEY (id);
ALTER TABLE public.demand_interactions ADD CHECK (interaction_type IN ('comment','status_change','assignment','update','adjustment_request'));
CREATE INDEX idx_di_channel ON public.demand_interactions(demand_id, channel);

CREATE TABLE public.demand_request_attachments (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_request_id uuid NOT NULL, file_name text NOT NULL, file_path text NOT NULL, file_type text NOT NULL, file_size integer NOT NULL, uploaded_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, comment_id uuid);
ALTER TABLE public.demand_request_attachments ADD PRIMARY KEY (id);
CREATE INDEX idx_dra_comment_id ON public.demand_request_attachments(comment_id);

CREATE TABLE public.demand_request_comments (id uuid DEFAULT gen_random_uuid() NOT NULL, request_id uuid NOT NULL, user_id uuid NOT NULL, content text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.demand_request_comments ADD PRIMARY KEY (id);

CREATE TABLE public.demand_requests (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, created_by uuid NOT NULL, title text NOT NULL, description text, priority text DEFAULT 'média'::text, service_id uuid, status text DEFAULT 'pending'::text NOT NULL, rejection_reason text, responded_by uuid, responded_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, board_id uuid, payment_required boolean DEFAULT true, payment_status text DEFAULT 'not_required'::text);
ALTER TABLE public.demand_requests ADD PRIMARY KEY (id);
ALTER TABLE public.demand_requests ADD CHECK (status IN ('pending','approved','rejected','returned'));
CREATE INDEX idx_demand_requests_board_id ON public.demand_requests(board_id);

CREATE TABLE public.demand_share_tokens (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, token text NOT NULL, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, expires_at timestamp with time zone, is_active boolean DEFAULT true NOT NULL, auto_join_board boolean DEFAULT false NOT NULL);
ALTER TABLE public.demand_share_tokens ADD PRIMARY KEY (id);
ALTER TABLE public.demand_share_tokens ADD UNIQUE (token);
CREATE INDEX idx_dst_demand_id ON public.demand_share_tokens(demand_id);
CREATE INDEX idx_dst_token ON public.demand_share_tokens(token);

CREATE TABLE public.demand_statuses (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, name text NOT NULL, color text DEFAULT '#6B7280'::text NOT NULL, is_system boolean DEFAULT false, created_at timestamp with time zone DEFAULT now() NOT NULL, board_id uuid);
ALTER TABLE public.demand_statuses ADD PRIMARY KEY (id);
CREATE INDEX idx_demand_statuses_board_id ON public.demand_statuses(board_id);

CREATE TABLE public.demand_subtasks (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, title text NOT NULL, completed boolean DEFAULT false NOT NULL, sort_order integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.demand_subtasks ADD PRIMARY KEY (id);

CREATE TABLE public.demand_templates (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, name text NOT NULL, title_template text, description_template text, priority text DEFAULT 'média'::text, service_id uuid, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, board_id uuid);
ALTER TABLE public.demand_templates ADD PRIMARY KEY (id);
CREATE INDEX idx_dt_board_id ON public.demand_templates(board_id);

CREATE TABLE public.demand_time_entries (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid NOT NULL, user_id uuid NOT NULL, started_at timestamp with time zone DEFAULT now() NOT NULL, ended_at timestamp with time zone, duration_seconds integer DEFAULT 0, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.demand_time_entries ADD PRIMARY KEY (id);
CREATE INDEX idx_dte_active ON public.demand_time_entries(demand_id, user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_dte_demand_id ON public.demand_time_entries(demand_id);
CREATE INDEX idx_dte_user_id ON public.demand_time_entries(user_id);

CREATE TABLE public.demands (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, title text NOT NULL, description text, team_id uuid NOT NULL, status_id uuid NOT NULL, priority text DEFAULT 'média'::text, due_date timestamp with time zone, assigned_to uuid, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, archived boolean DEFAULT false NOT NULL, archived_at timestamp with time zone, service_id uuid, time_in_progress_seconds integer DEFAULT 0, last_started_at timestamp with time zone, board_id uuid NOT NULL, delivered_at timestamp with time zone, board_sequence_number integer, meet_link text, status_changed_at timestamp with time zone DEFAULT now(), status_changed_by uuid, parent_demand_id uuid, subdemand_sort_order integer, recurring_demand_id uuid, is_overdue boolean DEFAULT false NOT NULL);
ALTER TABLE public.demands ADD PRIMARY KEY (id);
ALTER TABLE public.demands ADD CHECK (priority IN ('baixa','média','alta','urgente'));
CREATE INDEX idx_demands_archived ON public.demands(archived);
CREATE INDEX idx_demands_board_id ON public.demands(board_id);
CREATE UNIQUE INDEX idx_demands_board_sequence ON public.demands(board_id, board_sequence_number);
CREATE INDEX idx_demands_is_overdue ON public.demands(is_overdue) WHERE is_overdue = true;
CREATE INDEX idx_demands_parent ON public.demands(parent_demand_id) WHERE parent_demand_id IS NOT NULL;
CREATE INDEX idx_demands_parent_sort ON public.demands(parent_demand_id, subdemand_sort_order) WHERE parent_demand_id IS NOT NULL;
CREATE INDEX idx_demands_recurring_demand_id ON public.demands(recurring_demand_id);

CREATE TABLE public.google_calendar_tokens (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, access_token text NOT NULL, refresh_token text NOT NULL, token_expires_at timestamp with time zone NOT NULL, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
ALTER TABLE public.google_calendar_tokens ADD PRIMARY KEY (id);
ALTER TABLE public.google_calendar_tokens ADD UNIQUE (user_id);

CREATE TABLE public.note_share_tokens (id uuid DEFAULT gen_random_uuid() NOT NULL, note_id uuid NOT NULL, token text NOT NULL, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, expires_at timestamp with time zone, is_active boolean DEFAULT true NOT NULL);
ALTER TABLE public.note_share_tokens ADD PRIMARY KEY (id);
ALTER TABLE public.note_share_tokens ADD UNIQUE (token);

CREATE TABLE public.note_shares (id uuid DEFAULT gen_random_uuid() NOT NULL, note_id uuid NOT NULL, shared_with_user_id uuid NOT NULL, shared_by_user_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, permission note_share_permission DEFAULT 'viewer'::note_share_permission NOT NULL);
ALTER TABLE public.note_shares ADD PRIMARY KEY (id);
ALTER TABLE public.note_shares ADD UNIQUE (note_id, shared_with_user_id);

CREATE TABLE public.note_tags (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, name text NOT NULL, color text DEFAULT '#6366f1'::text, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.note_tags ADD PRIMARY KEY (id);
ALTER TABLE public.note_tags ADD UNIQUE (team_id, name);

CREATE TABLE public.notes (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, created_by uuid NOT NULL, title text DEFAULT 'Sem título'::text NOT NULL, content text, icon text DEFAULT '📝'::text, cover_url text, is_public boolean DEFAULT false NOT NULL, archived boolean DEFAULT false NOT NULL, parent_id uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, tags text[] DEFAULT '{}'::text[]);
ALTER TABLE public.notes ADD PRIMARY KEY (id);
CREATE INDEX idx_notes_created_by ON public.notes(created_by);
CREATE INDEX idx_notes_parent_id ON public.notes(parent_id);
CREATE INDEX idx_notes_tags ON public.notes USING gin(tags);
CREATE INDEX idx_notes_team_id ON public.notes(team_id);

CREATE TABLE public.notifications (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, title text NOT NULL, message text NOT NULL, type text DEFAULT 'info'::text, read boolean DEFAULT false, link text, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.notifications ADD PRIMARY KEY (id);

CREATE TABLE public.payments (id uuid DEFAULT gen_random_uuid() NOT NULL, demand_id uuid, demand_request_id uuid, user_id uuid NOT NULL, amount_cents integer NOT NULL, stripe_payment_intent_id text, stripe_checkout_session_id text, status text DEFAULT 'pending'::text NOT NULL, paid_at timestamp with time zone, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
ALTER TABLE public.payments ADD PRIMARY KEY (id);
CREATE INDEX idx_payments_demand_request_id ON public.payments(demand_request_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);

CREATE TABLE public.plans (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, slug text NOT NULL, description text, price_cents integer DEFAULT 0 NOT NULL, billing_period text DEFAULT 'monthly'::text NOT NULL, max_teams integer DEFAULT 1, max_boards integer DEFAULT 1, max_members integer DEFAULT 3, max_demands_per_month integer DEFAULT 30, max_services integer DEFAULT 5, max_notes integer DEFAULT 0, features jsonb DEFAULT '{}'::jsonb, is_active boolean DEFAULT true, sort_order integer DEFAULT 0, created_at timestamp with time zone DEFAULT now(), currency text DEFAULT 'BRL'::text NOT NULL, price_cents_monthly integer DEFAULT 0 NOT NULL, price_cents_yearly integer DEFAULT 0 NOT NULL, promo_price_cents_monthly integer, promo_price_cents_yearly integer);
ALTER TABLE public.plans ADD PRIMARY KEY (id);
ALTER TABLE public.plans ADD UNIQUE (slug);

CREATE TABLE public.profiles (id uuid NOT NULL, full_name text NOT NULL, avatar_url text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, bio text, job_title text, location text, website text, linkedin_url text, github_url text, banner_url text, trial_ends_at timestamp with time zone DEFAULT (now() + '10 days'::interval), phone text, state text, city text, email text, is_demand_history_public boolean DEFAULT false NOT NULL, profile_visibility jsonb DEFAULT '{}'::jsonb NOT NULL, banner_gradient text, whatsapp_phone text, whatsapp_verified_at timestamp with time zone, default_whatsapp_board_id uuid);
ALTER TABLE public.profiles ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX profiles_whatsapp_phone_unique ON public.profiles(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;

CREATE TABLE public.project_demands (id uuid DEFAULT gen_random_uuid() NOT NULL, project_id uuid NOT NULL, demand_id uuid NOT NULL, added_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.project_demands ADD PRIMARY KEY (id);
ALTER TABLE public.project_demands ADD UNIQUE (project_id, demand_id);
CREATE INDEX idx_pd_demand_id ON public.project_demands(demand_id);
CREATE INDEX idx_pd_folder_id ON public.project_demands(project_id);

CREATE TABLE public.project_shares (id uuid DEFAULT gen_random_uuid() NOT NULL, project_id uuid NOT NULL, user_id uuid NOT NULL, shared_at timestamp with time zone DEFAULT now() NOT NULL, permission text DEFAULT 'view'::text NOT NULL);
ALTER TABLE public.project_shares ADD PRIMARY KEY (id);
ALTER TABLE public.project_shares ADD UNIQUE (project_id, user_id);
CREATE INDEX idx_ps_folder ON public.project_shares(project_id);
CREATE INDEX idx_ps_user ON public.project_shares(user_id);

CREATE TABLE public.projects (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, color text DEFAULT '#6B7280'::text NOT NULL, team_id uuid NOT NULL, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.projects ADD PRIMARY KEY (id);
CREATE INDEX idx_projects_team_id ON public.projects(team_id);

CREATE TABLE public.recurring_demands (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, board_id uuid NOT NULL, created_by uuid NOT NULL, title text NOT NULL, description text, priority text DEFAULT 'média'::text, status_id uuid NOT NULL, service_id uuid, assignee_ids uuid[] DEFAULT '{}'::uuid[], frequency text NOT NULL, weekdays integer[] DEFAULT '{}'::integer[], day_of_month integer, start_date date NOT NULL, end_date date, is_active boolean DEFAULT true NOT NULL, last_generated_at timestamp with time zone, next_run_date date NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.recurring_demands ADD PRIMARY KEY (id);
ALTER TABLE public.recurring_demands ADD CHECK (frequency IN ('daily','weekly','biweekly','monthly','test_1min','test_5min'));

CREATE TABLE public.services (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, name text NOT NULL, description text, estimated_hours integer DEFAULT 24 NOT NULL, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, board_id uuid, price_cents integer DEFAULT 0 NOT NULL, parent_id uuid);
ALTER TABLE public.services ADD PRIMARY KEY (id);
CREATE INDEX idx_services_board_id ON public.services(board_id);
CREATE INDEX idx_services_parent_id ON public.services(parent_id);

CREATE TABLE public.subscriptions (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, plan_id uuid NOT NULL, status text DEFAULT 'active'::text NOT NULL, current_period_start timestamp with time zone DEFAULT now() NOT NULL, current_period_end timestamp with time zone, stripe_subscription_id text, stripe_customer_id text, cancel_at_period_end boolean DEFAULT false, trial_ends_at timestamp with time zone, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
ALTER TABLE public.subscriptions ADD PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD UNIQUE (team_id);

CREATE TABLE public.team_join_requests (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, user_id uuid NOT NULL, status text DEFAULT 'pending'::text NOT NULL, requested_at timestamp with time zone DEFAULT now() NOT NULL, responded_at timestamp with time zone, responded_by uuid, message text);
ALTER TABLE public.team_join_requests ADD PRIMARY KEY (id);
ALTER TABLE public.team_join_requests ADD UNIQUE (team_id, user_id);
ALTER TABLE public.team_join_requests ADD CHECK (status IN ('pending','approved','rejected'));

CREATE TABLE public.team_members (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, team_id uuid NOT NULL, user_id uuid NOT NULL, joined_at timestamp with time zone DEFAULT now() NOT NULL, position_id uuid, role team_role DEFAULT 'requester'::team_role NOT NULL);
ALTER TABLE public.team_members ADD PRIMARY KEY (id);
ALTER TABLE public.team_members ADD UNIQUE (team_id, user_id);
CREATE INDEX idx_team_members_position_id ON public.team_members(position_id);

CREATE TABLE public.team_positions (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, name text NOT NULL, description text, color text DEFAULT '#6B7280'::text NOT NULL, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, text_color text DEFAULT 'auto'::text);
ALTER TABLE public.team_positions ADD PRIMARY KEY (id);
ALTER TABLE public.team_positions ADD UNIQUE (team_id, name);
CREATE INDEX idx_team_positions_team_id ON public.team_positions(team_id);

CREATE TABLE public.teams (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, name text NOT NULL, description text, access_code text NOT NULL, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, scope_description text, contract_start_date date, contract_end_date date, monthly_demand_limit integer DEFAULT 0, active boolean DEFAULT true);
ALTER TABLE public.teams ADD PRIMARY KEY (id);
ALTER TABLE public.teams ADD UNIQUE (access_code);

CREATE TABLE public.trial_coupons (id uuid DEFAULT gen_random_uuid() NOT NULL, code text NOT NULL, plan_id uuid NOT NULL, trial_days integer DEFAULT 15 NOT NULL, max_uses integer DEFAULT 1 NOT NULL, times_used integer DEFAULT 0 NOT NULL, is_active boolean DEFAULT true NOT NULL, description text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, expires_at timestamp with time zone);
ALTER TABLE public.trial_coupons ADD PRIMARY KEY (id);
ALTER TABLE public.trial_coupons ADD UNIQUE (code);

CREATE TABLE public.usage_records (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, period_start timestamp with time zone NOT NULL, period_end timestamp with time zone NOT NULL, demands_created integer DEFAULT 0, members_count integer DEFAULT 0, boards_count integer DEFAULT 0, notes_count integer DEFAULT 0, storage_bytes bigint DEFAULT 0, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());
ALTER TABLE public.usage_records ADD PRIMARY KEY (id);
ALTER TABLE public.usage_records ADD UNIQUE (team_id, period_start);

CREATE TABLE public.user_preferences (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, preference_key text NOT NULL, preference_value jsonb DEFAULT '{}'::jsonb NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.user_preferences ADD PRIMARY KEY (id);
ALTER TABLE public.user_preferences ADD UNIQUE (user_id, preference_key);

CREATE TABLE public.user_roles (id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL, user_id uuid NOT NULL, role app_role DEFAULT 'member'::app_role NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.user_roles ADD PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD UNIQUE (user_id, role);

CREATE TABLE public.webhook_logs (id uuid DEFAULT gen_random_uuid() NOT NULL, subscription_id uuid NOT NULL, event text NOT NULL, payload jsonb, response_status integer, response_body text, success boolean DEFAULT false NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.webhook_logs ADD PRIMARY KEY (id);
CREATE INDEX idx_wl_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_wl_subscription_id ON public.webhook_logs(subscription_id);

CREATE TABLE public.webhook_subscriptions (id uuid DEFAULT gen_random_uuid() NOT NULL, team_id uuid NOT NULL, url text NOT NULL, events text[] DEFAULT '{}'::text[] NOT NULL, is_active boolean DEFAULT true NOT NULL, last_triggered_at timestamp with time zone, created_by uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, secret_hash text NOT NULL, secret_prefix text NOT NULL);
ALTER TABLE public.webhook_subscriptions ADD PRIMARY KEY (id);
CREATE INDEX idx_ws_is_active ON public.webhook_subscriptions(is_active);
CREATE INDEX idx_ws_team_id ON public.webhook_subscriptions(team_id);

CREATE TABLE public.whatsapp_inbound_logs (id uuid DEFAULT gen_random_uuid() NOT NULL, from_phone text NOT NULL, to_phone text, raw_message text, matched_board_id uuid, matched_user_id uuid, created_demand_id uuid, created_request_id uuid, ai_extraction jsonb, status text DEFAULT 'received'::text NOT NULL, error text, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.whatsapp_inbound_logs ADD PRIMARY KEY (id);
CREATE INDEX wil_created_idx ON public.whatsapp_inbound_logs(created_at DESC);
CREATE INDEX wil_phone_created_idx ON public.whatsapp_inbound_logs(from_phone, created_at DESC);

CREATE TABLE public.whatsapp_phone_codes (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, phone text NOT NULL, code_hash text NOT NULL, expires_at timestamp with time zone NOT NULL, consumed_at timestamp with time zone, attempts integer DEFAULT 0 NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.whatsapp_phone_codes ADD PRIMARY KEY (id);
CREATE INDEX wpc_user_idx ON public.whatsapp_phone_codes(user_id, created_at DESC);
