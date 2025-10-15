-- Get the newly created user ID and set up wallet and admin role
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'iicbooking@iitr.ac.in';
  
  -- Update profile if it exists (trigger may have created it)
  UPDATE public.profiles 
  SET email = 'iicbooking@iitr.ac.in', 
      full_name = 'IIC Booking Admin'
  WHERE id = new_user_id;
  
  -- Create wallet if it doesn't exist
  INSERT INTO public.wallets (user_id, balance)
  VALUES (new_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;