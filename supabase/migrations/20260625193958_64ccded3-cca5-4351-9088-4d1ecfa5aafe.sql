-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  access_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  scope_description text,
  contract_start_date date,
  contract_end_date date,
  monthly_demand_limit integer DEFAULT 0,
  active boolean DEFAULT true
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.team_role AS ENUM ('admin', 'moderator', 'requester', 'executor');

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  role team_role NOT NULL DEFAULT 'requester',
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_team_members_role ON public.team_members(team_id, role);

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id)
$$;

CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_team_role(_user_id uuid, _team_id uuid, _role team_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role IN ('admin', 'moderator'))
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin')
$$;

CREATE TABLE public.demand_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.demand_statuses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  estimated_days integer NOT NULL DEFAULT 7,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  status_id UUID REFERENCES public.demand_statuses(id) NOT NULL,
  priority TEXT DEFAULT 'média',
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES public.services(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone,
  time_in_progress_seconds INTEGER DEFAULT 0,
  last_started_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_demands_archived ON public.demands(archived);

CREATE TABLE public.demand_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.demand_interactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demand_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(demand_id, user_id)
);
ALTER TABLE public.demand_assignees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  message TEXT,
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demand_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.demand_subtasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demand_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.demand_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demand_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title_template TEXT,
  description_template TEXT,
  priority TEXT DEFAULT 'média',
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.demand_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demand_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'média',
  service_id UUID REFERENCES public.services(id),
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  responded_by UUID REFERENCES public.profiles(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, preference_key)
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Basic policies
CREATE POLICY "auth view profiles" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "view all statuses" ON public.demand_statuses FOR SELECT USING (true);
CREATE POLICY "admin manage statuses" ON public.demand_statuses FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "view teams" ON public.teams FOR SELECT USING (auth.uid() = created_by OR auth.uid() IN (SELECT user_id FROM team_members WHERE team_id = teams.id));
CREATE POLICY "create teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update own teams" ON public.teams FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "delete own teams" ON public.teams FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "view team members" ON public.team_members FOR SELECT USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "join teams" ON public.team_members FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_team_role(auth.uid(), team_id, 'admin'));
CREATE POLICY "admin update members" ON public.team_members FOR UPDATE USING (public.has_team_role(auth.uid(), team_id, 'admin'));
CREATE POLICY "admin delete members" ON public.team_members FOR DELETE USING (public.has_team_role(auth.uid(), team_id, 'admin') OR auth.uid() = user_id);
CREATE POLICY "view demands" ON public.demands FOR SELECT USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "create demands" ON public.demands FOR INSERT WITH CHECK (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "update demands" ON public.demands FOR UPDATE USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "delete demands" ON public.demands FOR DELETE USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "view services" ON public.services FOR SELECT USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "manage services" ON public.services FOR ALL USING (public.is_team_admin_or_moderator(auth.uid(), team_id));
CREATE POLICY "view assignees" ON public.demand_assignees FOR SELECT USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "manage assignees" ON public.demand_assignees FOR ALL USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "view interactions" ON public.demand_interactions FOR SELECT USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "create interactions" ON public.demand_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own interactions" ON public.demand_interactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own interactions" ON public.demand_interactions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "view subtasks" ON public.demand_subtasks FOR SELECT USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "manage subtasks" ON public.demand_subtasks FOR ALL USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "view attachments" ON public.demand_attachments FOR SELECT USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "manage attachments" ON public.demand_attachments FOR ALL USING (demand_id IN (SELECT id FROM demands WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))));
CREATE POLICY "view templates" ON public.demand_templates FOR SELECT USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));
CREATE POLICY "manage templates" ON public.demand_templates FOR ALL USING (public.is_team_admin_or_moderator(auth.uid(), team_id));
CREATE POLICY "view own requests" ON public.demand_requests FOR SELECT USING (auth.uid() = created_by OR public.is_team_admin_or_moderator(auth.uid(), team_id));
CREATE POLICY "create requests" ON public.demand_requests FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update requests" ON public.demand_requests FOR UPDATE USING (auth.uid() = created_by OR public.is_team_admin_or_moderator(auth.uid(), team_id));
CREATE POLICY "delete requests" ON public.demand_requests FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "view own prefs" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "manage own prefs" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "view join req own" ON public.team_join_requests FOR SELECT USING (auth.uid() = user_id OR public.is_team_admin_or_moderator(auth.uid(), team_id));
CREATE POLICY "create join req" ON public.team_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update join req" ON public.team_join_requests FOR UPDATE USING (public.has_team_role(auth.uid(), team_id, 'admin'));

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.user_roles, public.teams, public.team_members, public.demand_statuses, public.services, public.demands, public.demand_interactions, public.demand_assignees, public.team_join_requests, public.notifications, public.demand_subtasks, public.demand_attachments, public.demand_templates, public.demand_requests, public.user_preferences TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.teams, public.team_members, public.demand_statuses, public.services, public.demands, public.demand_interactions, public.demand_assignees, public.team_join_requests, public.notifications, public.demand_subtasks, public.demand_attachments, public.demand_templates, public.demand_requests, public.user_preferences TO service_role;