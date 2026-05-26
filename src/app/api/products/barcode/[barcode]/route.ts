import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeBarcode } from '@/lib/barcode/barcode-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ barcode: string }> }
) {
  try {
    const { barcode } = await props.params;
    
    // 1. Sanitize input to prevent injection
    const cleanBarcode = sanitizeBarcode(barcode);
    if (!cleanBarcode) {
      return NextResponse.json(
        { error: 'Invalid or empty barcode parameter' },
        { status: 400 }
      );
    }

    // 2. Initialize Supabase Client
    const supabase = await createClient();

    // 3. Authenticate the User
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 4. Retrieve user's tenant ID
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError || !roleData) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant assignment not found' },
        { status: 403 }
      );
    }

    // 5. Query product by barcode or SKU under this tenant
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', roleData.tenant_id)
      .or(`barcode.eq.${cleanBarcode},sku.eq.${cleanBarcode}`)
      .maybeSingle();

    if (productError) {
      return NextResponse.json(
        { error: productError.message },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Return the found product
    return NextResponse.json(product);
  } catch (err: any) {
    console.error('Barcode lookup API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
