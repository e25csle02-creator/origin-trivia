-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.profiles
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    register_number,
    sin_no,
    branch,
    semester,
    handling_subject
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'register_number',
    NEW.raw_user_meta_data->>'sin_no',
    NEW.raw_user_meta_data->>'branch',
    NEW.raw_user_meta_data->>'semester',
    NEW.raw_user_meta_data->>'handling_subject'
  );

  -- Insert into public.user_roles
  INSERT INTO public.user_roles (
    user_id,
    role
  )
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'role')::app_role
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
