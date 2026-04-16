'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingBag, ArrowRight, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tenant_name: storeName,
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
      } else {
        toast.success("Si guul ah ayaad u diiwaangashay!");
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error("Signup Fetch Error:", err);
      setError("Cillad dhinaca khadka ah ayaa jirta. Fadlan hubi Internet-kaaga ama dami AdBlockers-ka khaasatan garaafka Brave.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white text-[#141b2d] font-sans">
      
      {/* LEFT SIDE - BRANDING (Hidden on small screens) */}
      <div className="hidden lg:flex w-1/2 bg-[#0b132b] relative overflow-hidden flex-col justify-between p-12 lg:p-20 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-500 rounded-full blur-[150px] opacity-30 mix-blend-screen" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-indigo-600 rounded-full blur-[150px] opacity-30 mix-blend-screen" />
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-16">
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center text-[#141b2d] shadow-xl">
              <ShoppingBag className="h-6 w-6 font-bold" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Dukaan<span className="text-blue-500">Pro</span></h1>
          </div>
          
          <h2 className="text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6 tracking-tighter">
            Maamul cusub,<br/>
            Ganacsi casri ah.
          </h2>
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed font-medium">
            Nidaamka iibka (POS), kaydka alaabta, warbixinaha, iyo xisaabaadka oo idil isku hal meel ka wada maamul adigoo badbaadinaya wakhti iyo kharash.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
           <div className="flex items-center space-x-4 text-zinc-300">
             <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10"><Zap className="h-5 w-5 text-blue-400" /></div>
             <p className="font-semibold text-sm">Xawaare aad u sareeya (Fast POS)</p>
           </div>
           <div className="flex items-center space-x-4 text-zinc-300">
             <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10"><BarChart3 className="h-5 w-5 text-green-400" /></div>
             <p className="font-semibold text-sm">Warbixino toos ah (Real-time Analytics)</p>
           </div>
           <div className="flex items-center space-x-4 text-zinc-300">
             <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10"><ShieldCheck className="h-5 w-5 text-indigo-400" /></div>
             <p className="font-semibold text-sm">Amni dhamaystiran (Supabase Security)</p>
           </div>
        </div>
      </div>

      {/* RIGHT SIDE - REGISTRATION FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-24 overflow-y-auto bg-[#f9f9fb] lg:bg-white relative">
        <div className="w-full max-w-md">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="h-14 w-14 bg-[#141b2d] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#141b2d]/20">
              <ShoppingBag className="h-7 w-7" />
            </div>
          </div>

          <div className="text-center lg:text-left mb-10">
             <h2 className="text-3xl sm:text-4xl font-extrabold text-[#141b2d] mb-3 tracking-tight">Samayso Ciwaan Cusub</h2>
             <p className="text-zinc-500 font-medium tracking-wide">Ku soo dhawow Dukaan-Pro. Bilaash ugu bilow!</p>
          </div>
          
          {error && (
            <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-2xl mb-8 text-sm text-center font-semibold shadow-sm backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-extrabold text-zinc-700 uppercase tracking-widest pl-1">Magaca Dukaanka</label>
              <Input 
                type="text" 
                required 
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="bg-white lg:bg-[#f9f9fb] h-14 border-zinc-200 ring-4 ring-transparent focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all font-semibold text-[#141b2d] text-base px-5 rounded-2xl shadow-sm" 
                placeholder="Tusaale: Xaaji Supermarket" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-extrabold text-zinc-700 uppercase tracking-widest pl-1">Email-ka Maamulaha</label>
              <Input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white lg:bg-[#f9f9fb] h-14 border-zinc-200 ring-4 ring-transparent focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all font-semibold text-[#141b2d] text-base px-5 rounded-2xl shadow-sm" 
                placeholder="admin@dukaan.pro" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-extrabold text-zinc-700 uppercase tracking-widest pl-1">Password</label>
              <Input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white lg:bg-[#f9f9fb] h-14 border-zinc-200 ring-4 ring-transparent focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all font-semibold text-[#141b2d] text-base px-5 rounded-2xl shadow-sm" 
                placeholder="••••••••" 
              />
            </div>
            
            <Button 
              disabled={loading}
              type="submit" 
              className="w-full h-14 mt-4 text-base font-extrabold bg-[#141b2d] hover:bg-blue-600 outline-none focus:ring-4 focus:ring-blue-500/20 text-white rounded-2xl shadow-xl shadow-[#141b2d]/10 transition-all active:scale-[0.98] group flex justify-center items-center"
            >
              {loading ? 'Haddaa la abuurayaa...' : (
                <>
                  Diiwaangali Dukaanka <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center mt-12 text-sm text-zinc-500 font-semibold">
            Horay ma u lahayd ciwaan? <Link href="/login" className="font-extrabold text-blue-600 hover:text-blue-700 transition-colors underline underline-offset-4 decoration-2 decoration-blue-200 hover:decoration-blue-600">Halkan ka Gal</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
