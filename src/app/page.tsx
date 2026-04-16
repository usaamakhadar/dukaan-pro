'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { lang, setLang } = useLanguage();

  const toggleLang = () => {
    setLang(lang === 'en' ? 'so' : 'en');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-zinc-950 to-zinc-900 overflow-hidden relative">
      
      {/* LANGUAGE OVERLAY */}
      <div className="absolute top-8 right-8 md:top-12 md:right-12 z-50">
         <button onClick={toggleLang} className="flex items-center text-sm font-bold text-zinc-300 hover:text-white transition-colors bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-lg active:scale-95">
           <Globe className="h-4 w-4 mr-2" />
           {lang === 'en' ? 'English (EN)' : 'Soomaali (SO)'}
         </button>
      </div>

      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Dukaan<span className="text-blue-500">Pro</span>
          </h1>
          <p className="text-zinc-400 max-w-[650px] mx-auto text-lg mb-10 leading-relaxed">
            {lang === 'en' 
              ? "The ultimate modern multi-tenant SaaS for Point of Sale (POS), Inventory Management, and PDF Invoicing. Scale your retail business intuitively with real-time analytics and Supabase row-level secure architecture."
              : "Nidaamka casriga ah ee ugu sahlan ee loogu talagalay Maareynta Dukaamada (POS), Diiwaangelinta Kaydka Alaabta, iyo soo saarida Rasiidhada. Si fudud u kobo ganacsigaaga."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 font-medium rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 active:scale-95 transition-transform">
                {lang === 'en' ? 'Start Selling Free' : 'Bilaash Isku-diiwaangali'}
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 font-medium rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white active:scale-95 transition-transform">
                {lang === 'en' ? 'Sign In' : 'Gal Dukaankaaga'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Background Decorators */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[30rem] w-[30rem] md:h-[50rem] md:w-[50rem] -translate-x-1/2 -translate-y-1/2 opacity-20 bg-blue-500 rounded-full blur-[120px]" />
    </main>
  );
}
