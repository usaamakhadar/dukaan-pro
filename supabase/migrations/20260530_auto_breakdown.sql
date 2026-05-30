-- 1. Add Parent Product and Breakdown Ratio columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS breakdown_ratio INTEGER;

-- 2. Update process_pos_checkout RPC to support atomic auto-breakdown on checkout
CREATE OR REPLACE FUNCTION process_pos_checkout(
    p_tenant_id UUID,
    p_cashier_id UUID,
    p_customer_id UUID,
    p_subtotal NUMERIC,
    p_tax NUMERIC,
    p_discount NUMERIC,
    p_total_amount NUMERIC,
    p_payment_method TEXT,
    p_status TEXT,
    p_items JSONB -- Array of { product_id, quantity, unit_price, total_price }
) RETURNS UUID AS $$
DECLARE
    new_sale_id UUID;
    item JSONB;
    current_stock INTEGER;
    prod_name TEXT;
    p_parent_id UUID;
    p_ratio INTEGER;
BEGIN
    -- 1. Create the Sale Record
    INSERT INTO public.sales (
        tenant_id, cashier_id, customer_id, 
        subtotal, tax, discount, total_amount, paid_amount, 
        payment_method, status
    ) VALUES (
        p_tenant_id, p_cashier_id, p_customer_id, 
        p_subtotal, p_tax, p_discount, p_total_amount, p_total_amount, 
        p_payment_method, p_status
    ) RETURNING id INTO new_sale_id;

    -- 2. Process Items & Deduct Stock
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Lock the product row for update to prevent race conditions
        SELECT stock, name, parent_product_id, breakdown_ratio 
        INTO current_stock, prod_name, p_parent_id, p_ratio 
        FROM public.products 
        WHERE id = (item->>'product_id')::UUID 
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found', item->>'product_id';
        END IF;

        -- If stock is insufficient, check if we can auto-breakdown from a parent product
        IF current_stock < (item->>'quantity')::INTEGER AND p_parent_id IS NOT NULL AND p_ratio IS NOT NULL AND p_ratio > 0 THEN
            DECLARE
                needed_qty INTEGER := (item->>'quantity')::INTEGER - current_stock;
                parent_packs_needed INTEGER := CEIL(needed_qty::DECIMAL / p_ratio::DECIMAL)::INTEGER;
                parent_stock INTEGER;
                parent_name TEXT;
            BEGIN
                -- Lock parent product
                SELECT stock, name INTO parent_stock, parent_name
                FROM public.products
                WHERE id = p_parent_id
                FOR UPDATE;
                
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Parent product for % not found', prod_name;
                END IF;
                
                IF parent_stock < parent_packs_needed THEN
                    RAISE EXCEPTION 'Insufficient stock for %. Available: % (Parent % stock: % is also insufficient to break down)', 
                        prod_name, current_stock, parent_name, parent_stock;
                END IF;
                
                -- Deduct from parent
                UPDATE public.products
                SET stock = stock - parent_packs_needed,
                    updated_at = NOW()
                WHERE id = p_parent_id;
                
                -- Add to current product stock
                UPDATE public.products
                SET stock = stock + (parent_packs_needed * p_ratio),
                    updated_at = NOW()
                WHERE id = (item->>'product_id')::UUID;
                
                -- Update local current_stock variable to reflect breakdown
                current_stock := current_stock + (parent_packs_needed * p_ratio);
            END;
        END IF;

        -- Check final stock status
        IF current_stock < (item->>'quantity')::INTEGER THEN
            RAISE EXCEPTION 'Insufficient stock for %. Available: %', prod_name, current_stock;
        END IF;

        -- Insert Sale Item
        INSERT INTO public.sale_items (
            tenant_id, sale_id, product_id, quantity, unit_price, total_price
        ) VALUES (
            p_tenant_id, 
            new_sale_id, 
            (item->>'product_id')::UUID, 
            (item->>'quantity')::INTEGER, 
            (item->>'unit_price')::DECIMAL, 
            (item->>'total_price')::DECIMAL
        );

        -- Update Stock
        UPDATE public.products 
        SET stock = stock - (item->>'quantity')::INTEGER,
            updated_at = NOW()
        WHERE id = (item->>'product_id')::UUID;
    END LOOP;

    -- 3. Update Customer Debt (if applicable)
    IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
        UPDATE public.customers 
        SET wallet_balance = COALESCE(wallet_balance, 0) - p_total_amount,
            updated_at = NOW()
        WHERE id = p_customer_id;
    END IF;

    RETURN new_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
