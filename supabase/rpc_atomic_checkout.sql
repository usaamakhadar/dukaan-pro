-- =========================================
-- ATOMIC POS CHECKOUT RPC
-- =========================================
-- This function guarantees that creating a sale, inserting items, 
-- deducting stock, and updating customer balances happen in ONE transaction.
-- If any step fails (e.g., negative stock), everything rolls back safely.

CREATE OR REPLACE FUNCTION process_pos_checkout(
    p_tenant_id UUID,
    p_cashier_id UUID,
    p_customer_id UUID,
    p_subtotal DECIMAL(10,2),
    p_tax DECIMAL(10,2),
    p_discount DECIMAL(10,2),
    p_total_amount DECIMAL(10,2),
    p_payment_method TEXT,
    p_status TEXT,
    p_items JSONB -- Array of { product_id, quantity, unit_price, total_price }
) RETURNS UUID AS $$
DECLARE
    new_sale_id UUID;
    item JSONB;
    current_stock INTEGER;
    prod_name TEXT;
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

        -- Lock the product row for update to prevent race conditions
        SELECT stock, name INTO current_stock, prod_name 
        FROM public.products 
        WHERE id = (item->>'product_id')::UUID 
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found', item->>'product_id';
        END IF;

        IF current_stock < (item->>'quantity')::INTEGER THEN
            RAISE EXCEPTION 'Insufficient stock for %. Available: %', prod_name, current_stock;
        END IF;

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
