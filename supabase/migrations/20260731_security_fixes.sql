-- 1. Helper function to get cashier names safely without exposing auth.users directly
CREATE OR REPLACE FUNCTION public.get_cashier_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Only allow if:
  -- - The calling user is querying their own name
  -- - The calling user is service_role
  -- - The calling user shares a tenant with the cashier
  IF auth.uid() = p_user_id 
     OR current_setting('role') = 'service_role'
     OR EXISTS (
       SELECT 1 
       FROM public.user_roles ur1
       JOIN public.user_roles ur2 ON ur1.tenant_id = ur2.tenant_id
       WHERE ur1.user_id = auth.uid() 
         AND ur2.user_id = p_user_id
     ) 
  THEN
    SELECT COALESCE(u.raw_user_meta_data->>'full_name', u.email, 'Cashier')
    INTO v_name
    FROM auth.users u
    WHERE u.id = p_user_id;
    RETURN v_name;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Revoke default execute from PUBLIC and grant to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.get_cashier_name(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cashier_name(UUID) TO authenticated, service_role;

-- 2. Drop and recreate tenant_cashiers view with security_invoker = true
DROP VIEW IF EXISTS public.tenant_cashiers;
CREATE OR REPLACE VIEW public.tenant_cashiers
WITH (security_invoker = true)
AS
SELECT 
  ur.user_id AS cashier_id,
  public.get_cashier_name(ur.user_id) AS cashier_name,
  ur.tenant_id
FROM public.user_roles ur;

-- 3. Add policy to public.user_roles to allow users to view other roles in the same tenant
DROP POLICY IF EXISTS "Users can view all roles in their tenant" ON public.user_roles;
CREATE POLICY "Users can view all roles in their tenant" 
ON public.user_roles FOR SELECT 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- 4. Secure existing SECURITY DEFINER functions (search_path & execution rights)
-- A. get_user_tenant_ids
ALTER FUNCTION public.get_user_tenant_ids() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_ids() TO authenticated, service_role;

-- B. handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- C. process_pos_checkout
ALTER FUNCTION public.process_pos_checkout(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.process_pos_checkout(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_pos_checkout(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB) TO authenticated, service_role;
