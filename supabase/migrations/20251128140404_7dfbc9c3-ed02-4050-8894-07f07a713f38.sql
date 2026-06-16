-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create teams table (without RLS policies that reference team_members)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  access_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team_members table first
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Now add RLS policies for teams that reference team_members
CREATE POLICY "Users can view teams they are members of"
  ON public.teams FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = teams.id
    )
  );

CREATE POLICY "Admins can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team creators can update their teams"
  ON public.teams FOR UPDATE
  USING (auth.uid() = created_by);

-- RLS for team_members
CREATE POLICY "Users can view team members of their teams"
  ON public.team_members FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = team_members.team_id
    )
  );

CREATE POLICY "Users can join teams with access code"
  ON public.team_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create demand_statuses table
CREATE TABLE public.demand_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.demand_statuses ENABLE ROW LEVEL SECURITY;

-- RLS for demand_statuses
CREATE POLICY "Anyone can view statuses"
  ON public.demand_statuses FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage statuses"
  ON public.demand_statuses FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default statuses
INSERT INTO public.demand_statuses (name, color, is_system) VALUES
  ('Em Andamento', '#3B82F6', true),
  ('Concluído', '#10B981', true),
  ('Atrasado', '#EF4444', true),
  ('Pendente', '#F59E0B', true);

-- Create demands table
CREATE TABLE public.demands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  status_id UUID REFERENCES public.demand_statuses(id) NOT NULL,
  priority TEXT CHECK (priority IN ('baixa', 'média', 'alta', 'urgente')) DEFAULT 'média',
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

-- RLS for demands
CREATE POLICY "Team members can view demands"
  ON public.demands FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = demands.team_id
    )
  );

CREATE POLICY "Team members can create demands"
  ON public.demands FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = team_id
    )
  );

CREATE POLICY "Team members can update demands"
  ON public.demands FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE team_id = demands.team_id
    )
  );

-- Create demand_interactions table
CREATE TABLE public.demand_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT CHECK (interaction_type IN ('comment', 'status_change', 'assignment', 'update')) NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.demand_interactions ENABLE ROW LEVEL SECURITY;

-- RLS for demand_interactions
CREATE POLICY "Team members can view interactions"
  ON public.demand_interactions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.team_members tm
      INNER JOIN public.demands d ON d.team_id = tm.team_id
      WHERE d.id = demand_interactions.demand_id
    )
  );

CREATE POLICY "Team members can create interactions"
  ON public.demand_interactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() IN (
      SELECT user_id FROM public.team_members tm
      INNER JOIN public.demands d ON d.team_id = tm.team_id
      WHERE d.id = demand_id
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    new.raw_user_meta_data->>'avatar_url'
  );
  
  -- First user is admin
  IF (SELECT COUNT(*) FROM public.profiles) = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'member');
  END IF;
  
  RETURN new;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();