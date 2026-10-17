-- Add order_number column to sales table for formatted Order IDs (e.g. 01-2026-10-18)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Create index for fast searching by order ID
CREATE INDEX IF NOT EXISTS idx_sales_order_number ON public.sales(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON public.sales(tenant_id, created_at);
