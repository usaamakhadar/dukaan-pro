import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'ok';
  let dbError: string | null = null;

  try {
    const supabase = createClient();
    // Lightweight query to keep Supabase warm and active
    const { error } = await supabase.from('products').select('id', { count: 'exact', head: true });
    
    if (error) {
      dbStatus = 'warning';
      dbError = error.message;
    }
  } catch (err: unknown) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : 'Database ping failed';
  }

  const latencyMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: 'ok',
      service: 'dukaan-pro',
      timestamp: new Date().toISOString(),
      latencyMs,
      database: {
        status: dbStatus,
        error: dbError,
      },
    },
    { status: 200 }
  );
}
