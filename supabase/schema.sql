-- =========================================
--  MULTI-TENANT SaaS POS & INVOICE SCHEMA (PRO VERSION)
-- =========================================

-- CLEANUP (Run this to reset tables safely during development)
DROP TABLE IF EXISTS audit_logs, stock_movements, purchase_items, purchases, suppliers, notification_logs, shifts, tenant_subscriptions, expenses, payments, invoices, sale_items, sales, products, categories, customers, user_roles, tenant_settings, tenants CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANTS TABLE
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE, -- Custom SaaS domain check (optional)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1A. TENANT SaaS SUBSCRIPTIONS (For Monetization)
CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_name TEXT DEFAULT 'trial',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'suspended', 'trial')),
    billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
    next_billing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1B. TENANT SETTINGS (Enhanced with Multi-Currency)
CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    currency TEXT DEFAULT 'USD',
    secondary_currency TEXT DEFAULT 'SOS', -- e.g. Somali Shilling
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000, -- Real-time exchange calculation
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    receipt_header TEXT,
    receipt_footer TEXT,
    enable_whatsapp_receipts BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS Extension (maps auth.users to tenants)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'owner', 'admin', 'accountant', 'inventory_staff', 'cashier')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- 2A. SHIFTS / CASH DRAWER (Pro Feature)
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(10,2),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT
);

-- 2B. CUSTOMERS (Enhanced with Wallet & Loyalty)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    wallet_balance DECIMAL(10,2) DEFAULT 0.00, -- Can be negative (Debt) or positive (Prepay/Deposit)
    credit_limit DECIMAL(10,2) DEFAULT 0.00, -- Optional max limit limit
    loyalty_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2C. SUPPLIERS (For Purchase Management)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance DECIMAL(10,2) DEFAULT 0.00, -- Money owed to supplier
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES (For Inventory organization)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS (Inventory)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5, -- Alert for low stock
    barcode TEXT,
    image_url TEXT,
    parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    breakdown_ratio INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unique barcodes per tenant (ignores null/empty)
CREATE UNIQUE INDEX idx_products_tenant_barcode ON products (tenant_id, barcode) WHERE barcode IS NOT NULL AND barcode <> '';


-- 4B. PURCHASES (Purchase Orders to Suppliers)
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    reference_number TEXT,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'received' CHECK (status IN ('pending', 'received', 'cancelled')),
    purchase_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4C. PURCHASE ITEMS (Line items for purchases)
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4D. STOCK MOVEMENTS (Audit Trail for Inventory)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    movement_type TEXT CHECK (movement_type IN ('sale', 'purchase', 'adjustment_in', 'adjustment_out', 'return')),
    quantity INTEGER NOT NULL, -- positive or negative
    reference_id UUID, -- Can be sale_id, purchase_id, etc.
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SALES (POS Checkout)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id), -- Binds sale to a shift
    cashier_id UUID REFERENCES auth.users(id),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- What customer actually handed over
    payment_method TEXT CHECK (payment_method IN ('cash_usd', 'cash_slsh', 'zaad', 'edahab', 'evc_plus', 'card', 'split', 'wallet', 'credit')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'debt', 'layaway')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SALE ITEMS (Line Items)
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INVOICES (Billing context)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PAYMENTS (Debt & Invoice payments tracking)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash_usd', 'cash_slsh', 'zaad', 'edahab', 'evc_plus', 'bank_transfer', 'wallet', 'card')),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EXPENSES (Operational costs)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    shift_id UUID REFERENCES shifts(id), -- Connect expense to current shift optionally
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. NOTIFICATION LOGS (WhatsApp/SMS Uniqueness)
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('receipt', 'debt_reminder', 'loyalty_promo')),
    channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    message_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AUDIT LOGS (Security & Traceability)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- e.g., 'DELETE_PRODUCT', 'UPDATE_SETTINGS'
    entity_type TEXT NOT NULL, -- e.g., 'product', 'invoice'
    entity_id UUID,
    details JSONB, -- stores before/after state
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
--  ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id(s)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids() 
RETURNS SETOF UUID AS $$
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Tenants Policy
CREATE POLICY "Users can view their own tenant" 
ON tenants FOR SELECT 
USING (id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can update their own tenant" 
ON tenants FOR UPDATE 
USING (id IN (SELECT public.get_user_tenant_ids()));

-- Tenant Subscriptions Policy
CREATE POLICY "Users can view their subscriptions" 
ON tenant_subscriptions FOR SELECT 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Tenant Settings Policy
CREATE POLICY "Users can view their tenant settings" 
ON tenant_settings FOR SELECT 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can update their tenant settings" 
ON tenant_settings FOR UPDATE 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- User Roles Policy
CREATE POLICY "Users can view their own roles" 
ON user_roles FOR SELECT 
USING (user_id = auth.uid());

-- Shifts Policy
CREATE POLICY "Users can manage tenant shifts" 
ON shifts FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Customers Policy
CREATE POLICY "Users can manage tenant customers" 
ON customers FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Suppliers Policy
CREATE POLICY "Users can manage tenant suppliers" 
ON suppliers FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Categories Policy
CREATE POLICY "Users can manage tenant categories" 
ON categories FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Products Policy
CREATE POLICY "Users can manage tenant products" 
ON products FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Purchases Policy
CREATE POLICY "Users can manage tenant purchases" 
ON purchases FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Purchase Items Policy
CREATE POLICY "Users can manage tenant purchase items" 
ON purchase_items FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Stock Movements Policy
CREATE POLICY "Users can manage tenant stock movements" 
ON stock_movements FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Sales Policy
CREATE POLICY "Users can manage tenant sales" 
ON sales FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Sale Items Policy
CREATE POLICY "Users can manage tenant sale items" 
ON sale_items FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Invoices Policy
CREATE POLICY "Users can manage tenant invoices" 
ON invoices FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Payments Policy
CREATE POLICY "Users can manage tenant payments" 
ON payments FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Expenses Policy
CREATE POLICY "Users can manage tenant expenses" 
ON expenses FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Notification Logs Policy
CREATE POLICY "Users can manage notifications" 
ON notification_logs FOR ALL 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Audit Logs Policy
CREATE POLICY "Users can view tenant audit logs" 
ON audit_logs FOR SELECT 
USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can insert tenant audit logs" 
ON audit_logs FOR INSERT 
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- =========================================
--  AUTH TRIGGER FOR AUTO-TENANT CREATION
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  new_tenant_id UUID;
  tenant_name TEXT;
BEGIN
  -- Extract tenant_name from meta_data (provided during signup)
  tenant_name := coalesce(new.raw_user_meta_data->>'tenant_name', 'My Store');

  -- Create the tenant
  INSERT INTO public.tenants (name) VALUES (tenant_name) RETURNING id INTO new_tenant_id;
  
  -- Create tenant settings
  INSERT INTO public.tenant_settings (tenant_id) VALUES (new_tenant_id);

  -- Create default subscription as 'trial' (14 days free)
  INSERT INTO public.tenant_subscriptions (tenant_id, plan_name, next_billing_date) 
  VALUES (new_tenant_id, 'trial', (NOW() + interval '14 days'));

  -- Create the user role as owner
  INSERT INTO public.user_roles (user_id, tenant_id, role) 
  VALUES (new.id, new_tenant_id, 'owner');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger whenever a new verified user registers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
