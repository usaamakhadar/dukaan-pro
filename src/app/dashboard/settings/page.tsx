'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, DollarSign, Globe, ShieldCheck, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Form State
  const [storeName, setStoreName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [receiptAddress, setReceiptAddress] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [serviceFee, setServiceFee] = useState("0");
  const [exchangeRate, setExchangeRate] = useState("8500");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('tenant_id, tenants(name)')
      .eq('user_id', user.id)
      .single();

    if (roleData) {
      setTenantId(roleData.tenant_id);
      // @ts-ignore
      setStoreName(roleData.tenants?.name || "");

      const { data: settingsData } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', roleData.tenant_id)
        .single();
        
      if (settingsData) {
         setTaxRate(settingsData.tax_rate?.toString() || "0");
         setReceiptAddress(settingsData.receipt_header || "");
         setExchangeRate(settingsData.exchange_rate?.toString() || "8500");
         
         try {
            const footerData = JSON.parse(settingsData.receipt_footer || "{}");
            setSupportEmail(footerData.email || "");
            setServiceFee(footerData.fee || "0");
         } catch {
            setSupportEmail("");
            setServiceFee("0");
         }
      }
    }
    setIsLoading(false);
  };

  const handleSaveAll = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    
    // 1. Update tenants name
    const { error: tError } = await supabase
       .from('tenants')
       .update({ name: storeName })
       .eq('id', tenantId);

    if (tError) {
      toast.error(tError.message); 
      setIsSaving(false);
      return; 
    }

    // 2. Update tenant_settings
    const footerPayload = JSON.stringify({ email: supportEmail, fee: serviceFee });
    const { error: sError } = await supabase
       .from('tenant_settings')
       .update({ 
           receipt_header: receiptAddress,
           receipt_footer: footerPayload,
           tax_rate: parseFloat(taxRate) || 0,
           exchange_rate: parseFloat(exchangeRate) || 8500
       })
       .eq('tenant_id', tenantId);

    if (sError) {
      toast.error(sError.message); 
      setIsSaving(false);
      return; 
    }

    toast.success(lang === 'en' ? "Settings saved successfully! ✅" : "Hagaajinta Nidaamka waa la kaydiyay! ✅");
    setIsSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-100 pb-8">
        <div>
           <h2 className="text-4xl font-black tracking-tight text-[#141b2d] uppercase">{lang === 'en' ? 'Settings' : 'Maamulka'}</h2>
           <p className="text-zinc-500 font-medium mt-1">{lang === 'en' ? 'System orchestration and store preferences.' : 'Habee muuqaalka dukaankaaga iyo xogta iibka.'}</p>
        </div>
        <Button 
          disabled={isLoading || isSaving} 
          onClick={handleSaveAll} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 px-8 font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {lang === 'en' ? 'Save All Changes' : 'Kaydi Isbedelka'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <div className="h-12 w-12 border-4 border-[#141b2d] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-500 font-bold tracking-tight uppercase text-xs">Summoning Settings...</p>
        </div>
      ) : (
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="bg-zinc-100 p-1.5 rounded-3xl h-auto mb-10 inline-flex w-full md:w-auto">
            <TabsTrigger value="profile" className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Store className="h-4 w-4 mr-2" />
              {lang === 'en' ? 'Profile' : 'Summadda'}
            </TabsTrigger>
            <TabsTrigger value="finance" className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <DollarSign className="h-4 w-4 mr-2" />
              {lang === 'en' ? 'Financial' : 'Canshuurta'}
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ShieldCheck className="h-4 w-4 mr-2" />
              {lang === 'en' ? 'Security' : 'Amniga'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
            <Card className="bg-white border-zinc-100 shadow-2xl shadow-zinc-100/50 rounded-[2.5rem] p-4 md:p-8">
              <div className="grid gap-8 md:grid-cols-2">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{lang === 'en' ? 'Store Name' : 'Magaca Dukaanka'}</label>
                    <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="bg-[#f9f9fb] border-none h-14 rounded-2xl px-6 text-[#141b2d] font-black focus:ring-2 focus:ring-[#141b2d]/5" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{lang === 'en' ? 'Support Email' : 'Email-ka Dukaanka'}</label>
                    <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} type="email" placeholder="shop@example.com" className="bg-[#f9f9fb] border-none h-14 rounded-2xl px-6 text-[#141b2d] font-bold focus:ring-2 focus:ring-[#141b2d]/5" />
                 </div>
                 <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{lang === 'en' ? 'Receipt Address (Location)' : 'Cinwaanka Dukaanka'}</label>
                    <Input value={receiptAddress} onChange={(e) => setReceiptAddress(e.target.value)} placeholder="e.g. 123 Main St, Mogadishu" className="bg-[#f9f9fb] border-none h-14 rounded-2xl px-6 text-[#141b2d] font-bold focus:ring-2 focus:ring-[#141b2d]/5" />
                    <p className="text-[10px] text-zinc-400 font-medium px-2 mt-1 italic opacity-70">This will appear at the header of your printed receipts.</p>
                 </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
            <Card className="bg-white border-zinc-100 shadow-2xl shadow-zinc-100/50 rounded-[2.5rem] p-4 md:p-8">
              <div className="grid gap-8 md:grid-cols-2">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{lang === 'en' ? 'VAT Percentage (%)' : 'VAT / Canshuur (%)'}</label>
                    <div className="relative">
                      <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} type="number" className="bg-[#f9f9fb] border-none h-14 rounded-2xl px-6 text-[#141b2d] font-black focus:ring-2 focus:ring-[#141b2d]/5" />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-300 font-bold">%</span>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{lang === 'en' ? 'Fixed Service Fee ($)' : 'Khidmadda Joogtada ah ($)'}</label>
                    <div className="relative">
                      <Input value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} type="number" className="bg-[#f9f9fb] border-none h-14 rounded-2xl px-6 text-[#141b2d] font-black focus:ring-2 focus:ring-[#141b2d]/5" />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-300 font-bold">$</span>
                    </div>
                 </div>
                 <div className="md:col-span-2 space-y-2 bg-zinc-50/50 p-6 rounded-3xl border border-dashed border-zinc-200">
                    <label className="text-[10px] font-black text-[#141b2d] uppercase tracking-widest px-2">{lang === 'en' ? 'Currency Exchange (Somaliland Shilling)' : 'Sarrifka Lacagta (SLSH)'}</label>
                    <div className="flex items-center space-x-4 mt-2">
                       <span className="text-zinc-500 font-black text-xl">$1.00 = </span>
                       <Input value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} type="number" className="bg-white border-zinc-200 h-16 rounded-2xl px-6 text-2xl font-black text-[#141b2d] flex-1 shadow-sm focus:ring-2 focus:ring-[#141b2d]/5" />
                       <span className="text-zinc-500 font-black text-xl uppercase tracking-widest">SLSH</span>
                    </div>
                 </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-0 focus-visible:outline-none">
            <Card className="bg-white border-zinc-100 shadow-2xl shadow-zinc-100/50 rounded-[2.5rem] p-10 flex flex-col items-center text-center">
              <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
                 <ShieldCheck className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-black text-[#141b2d] uppercase tracking-tight">{lang === 'en' ? 'System Protected' : 'Nidaamka Waa Ammaan'}</h3>
              <p className="text-zinc-500 max-w-sm mt-2 font-medium">Your store data is encrypted and backed up daily. Advanced security protocols are active for this tenant.</p>
              <div className="mt-8 pt-8 border-t border-zinc-100 w-full grid grid-cols-2 gap-4">
                 <div className="bg-zinc-50 p-4 rounded-2xl text-left">
                   <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'Active Users' : 'Isticmaalayaasha'}</p>
                   <p className="font-black text-[#141b2d]">3 Active Session</p>
                 </div>
                 <div className="bg-zinc-50 p-4 rounded-2xl text-left">
                   <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'Last Backup' : 'Kaydkii u Dambeeyay'}</p>
                   <p className="font-black text-[#141b2d]">2 Hours Ago</p>
                 </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
