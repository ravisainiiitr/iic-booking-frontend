-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update equipment table with additional fields
ALTER TABLE public.equipment
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS internal_rate NUMERIC,
ADD COLUMN IF NOT EXISTS external_rate NUMERIC,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS technical_contact TEXT,
ADD COLUMN IF NOT EXISTS full_details_url TEXT;

-- Migrate existing rate_per_hour to internal_rate
UPDATE public.equipment 
SET internal_rate = COALESCE(internal_rate, rate_per_hour),
    external_rate = COALESCE(external_rate, rate_per_hour * 1.5);

-- RLS policies for equipment - admins can modify
CREATE POLICY "Admins can update equipment"
ON public.equipment
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert equipment"
ON public.equipment
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete equipment"
ON public.equipment
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));