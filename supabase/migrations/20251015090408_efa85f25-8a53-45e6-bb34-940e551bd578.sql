-- Add new user role types
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'iitr_student';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'iitr_faculty';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'officer_in_charge';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'operator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'external_academic';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'external_rnd';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'industrial_user';