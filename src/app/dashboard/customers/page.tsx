'use client';

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Mail, Phone, MapPin, PlusCircle, Trash2, Search, Pencil, Wallet, History, Printer, CreditCard, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import CsvImporter from "@/components/CsvImporter";

type Customer = { 
  id: string; 
  name: string; 
  email: string | null; 
  phone: string | null; 
  address: string | null; 
  wallet_balance: number;
  spent: string;
};

const PrintPageStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @media print {
      @page { 
        margin: 0;
        size: 80mm;
      }
      /* Collapse height of all layout containers to prevent extra pages */
      html, body, #__next, main, [data-radix-portal], .flex-1 {
        height: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: white !important;
      }
      /* Hide Radix portals, dialog overlays, wrappers, and fixed layouts to prevent blank pages */
      [data-radix-portal],
      div[role="dialog"],
      div[data-state],
      .fixed,
      .print\\:hidden {
        display: none !important;
      }
      body * { 
        visibility: hidden !important; 
      }
      .print-target, .print-target * { 
         visibility: visible !important; 
      }
      .print-target { 
         position: absolute !important; 
         left: 0 !important; 
         top: 0 !important;
         width: 80mm !important;
         height: auto !important;
         min-height: auto !important;
         margin: 0 !important;
         padding: 8px !important;
         box-shadow: none !important; 
         border: none !important; 
         background: white !important;
         display: block !important;
      }
    }
  `}} />
);

export default function CustomersPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const statementRef = useRef<HTMLDivElement>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [searchQuery, setSearchQuery] = useState("");

  // Customer Profile State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAmountSLSH, setPaymentAmountSLSH] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_usd");
  const [exchangeRate, setExchangeRate] = useState(8500);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Get Tenant ID
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('tenant_id, tenants(name)')
      .eq('user_id', user.id)
      .single();

    if (roleData) {
      setTenantId(roleData.tenant_id);
      // @ts-ignore
      setStoreName(roleData.tenants?.name || "");

      // Fetch settings
      const { data: settings } = await supabase.from('tenant_settings').select('*').eq('tenant_id', roleData.tenant_id).single();
      if (settings) {
        setTenantSettings(settings);
        if (settings.exchange_rate) setExchangeRate(settings.exchange_rate);
      }
      
      // Fetch Customers with their Sales
      const { data: custData } = await supabase
        .from('customers')
        .select('*, sales(total_amount, status)')
        .order('created_at', { ascending: false });
        
      if (custData) {
        setCustomers(custData.map((c: any) => {
          // Aggregate spent from completed sales
          const spent = c.sales
             ?.filter((s: any) => s.status === 'completed')
             ?.reduce((acc: number, curr: any) => acc + Number(curr.total_amount), 0) || 0;

          return {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            address: c.address,
            wallet_balance: parseFloat(c.wallet_balance || "0"),
            spent: `$${spent.toFixed(2)}`
          };
        }));
        
        // Fetch exchange rate once
        const { data: settings } = await supabase.from('tenant_settings').select('exchange_rate').eq('tenant_id', roleData.tenant_id).single();
        if (settings?.exchange_rate) setExchangeRate(settings.exchange_rate);
      }
    }
    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setIsAddOpen(true);
  };

  const filteredCustomers = customers.filter((c: Customer) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!formData.name) {
      toast.error(lang === 'en' ? "Customer name is required. ⚠️" : "Magaca macmiilka waa in la buuxiyaa. ⚠️");
      return;
    }

    const customerData = {
      tenant_id: tenantId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
    };

    const { data, error } = await supabase.from('customers').insert([customerData]).select().single();

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setCustomers((prev: any) => [{
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        wallet_balance: 0,
        spent: "$0.00"
      }, ...prev]);
    }
    
    setIsAddOpen(false);
    toast.success(lang === 'en' ? "Customer added successfully! 👤" : "Macaamiil cusub waa lagu daray! 👤");
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(lang === 'en' ? `Delete customer ${name}?` : `Ma hubtaa inaad tirtirto macmiilka ${name}?`)) {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (!error) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        toast.success(lang === 'en' ? "Customer deleted!" : "Wa la tirtiray!");
      } else {
         toast.error(error.message);
      }
    }
  };

  const handleUpdate = async () => {
    if (!selectedCustomer) return;
    const { error } = await supabase.from('customers').update({
       name: selectedCustomer.name,
       email: selectedCustomer.email,
       phone: selectedCustomer.phone,
       address: selectedCustomer.address
    }).eq('id', selectedCustomer.id);

    if (error) {
       toast.error(error.message);
    } else {
       toast.success(lang === 'en' ? "Profile Updated!" : "Profile-ka waa la bedelay!");
       fetchCustomers();
    }
  };

  const handlePayDebt = async () => {
    if (!selectedCustomer || !paymentAmount) return;
    const amountUSD = parseFloat(paymentAmount);
    if (isNaN(amountUSD) || amountUSD <= 0) return;

    // 1. Update Balance
    const newBal = selectedCustomer.wallet_balance + amountUSD;
    const { error: balError } = await supabase.from('customers').update({ wallet_balance: newBal }).eq('id', selectedCustomer.id);

    if (balError) {
       toast.error(balError.message);
       return;
    }

    // 2. Log Payment Record
    await supabase.from('payments').insert([{
       tenant_id: tenantId,
       customer_id: selectedCustomer.id,
       amount: amountUSD,
       payment_method: paymentMethod,
       payment_date: new Date().toISOString()
    }]);

    toast.success(lang === 'en' ? `Payment of $${amountUSD.toFixed(2)} recorded! 💸` : `Lacag qabasho dhan $${amountUSD.toFixed(2)} waa la xereeyay! 💸`);
    setPaymentAmount("");
    setPaymentAmountSLSH("");
    setIsPaying(false);
    fetchCustomers();
    // Update modal local state
    setSelectedCustomer(prev => prev ? { ...prev, wallet_balance: newBal } : null);
  };

  const handlePrintStatement = () => {
    window.print();
  };

  const handleUSDChange = (val: string) => {
    setPaymentAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
       setPaymentAmountSLSH((num * exchangeRate).toFixed(0));
    } else {
       setPaymentAmountSLSH("");
    }
  };

  const handleSLSHChange = (val: string) => {
    setPaymentAmountSLSH(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
       setPaymentAmount((num / exchangeRate).toFixed(2));
    } else {
       setPaymentAmount("");
    }
  };

  const handleOpenProfile = (c: Customer) => {
    setSelectedCustomer(c);
    setIsProfileOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl relative">
      <PrintPageStyles />
      
      {/* --- PROFESSIONAL PRINT VIEW (Statement) --- */}
      {selectedCustomer && (
        <div ref={statementRef} className="absolute top-[-9999px] left-[-9999px] print-target w-[80mm] bg-white text-black p-2 text-[9px] leading-tight font-mono flex flex-col items-center justify-start">
          <div className="w-full bg-white">
             <div className="text-center mb-1">
                <p className="text-[8px] font-bold uppercase tracking-widest">Debt Statement #{selectedCustomer.id.slice(0,6).toUpperCase()}</p>
             </div>
             <div className="flex justify-between text-[8px] mb-2 border-b border-zinc-200 pb-1">
                <span>{new Date().toLocaleDateString()}</span>
                <span>{new Date().toLocaleTimeString()}</span>
             </div>

             <div className="text-center mb-3">
                <h1 className="text-sm font-black uppercase mb-0.5">{storeName || "MY STORE"}</h1>
                {tenantSettings?.receipt_header && (
                   <p className="text-[8px] font-medium leading-tight whitespace-pre-wrap">{tenantSettings.receipt_header}</p>
                )}
                
                {(() => {
                   if (!tenantSettings?.receipt_footer) return null;
                   try {
                      const parsedFooter = JSON.parse(tenantSettings.receipt_footer);
                      const hasPhones = parsedFooter.phone1 || parsedFooter.phone2 || parsedFooter.phone3;
                      const hasPayments = parsedFooter.zaad || parsedFooter.edahab;
                      
                      return (
                         <div className="text-[8px] font-bold leading-tight font-mono space-y-0.5 mt-0.5">
                            {hasPhones && (
                               <p>
                                  Tel: {[parsedFooter.phone1, parsedFooter.phone2, parsedFooter.phone3].filter(Boolean).join(" | ")}
                               </p>
                            )}
                            {hasPayments && (
                               <p>
                                  {[
                                     parsedFooter.zaad ? `ZAAD: ${parsedFooter.zaad}` : null,
                                     parsedFooter.edahab ? `E-Dahab: ${parsedFooter.edahab}` : null
                                  ].filter(Boolean).join(" // ")}
                               </p>
                            )}
                         </div>
                      );
                   } catch (e) {
                      return null;
                   }
                })()}
             </div>

             <div className="border-t border-b border-black py-1 mb-3">
                 <h2 className="text-center text-[10px] font-black uppercase tracking-widest">Warqadda Deynta</h2>
              </div>

              <div className="space-y-1 mb-4">
                 <div className="flex justify-between items-center border-b border-zinc-100 pb-0.5">
                    <span className="font-bold uppercase text-[9px]">Macmiilka:</span>
                    <span className="font-black uppercase text-[9px]">{selectedCustomer.name}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-zinc-100 pb-0.5">
                    <span className="font-bold uppercase text-[9px]">Taleefanka:</span>
                    <span className="font-bold text-[9px]">{selectedCustomer.phone || "---"}</span>
                 </div>
                 
                 <div className="border-y border-black mt-2 py-1">
                    <div className="flex justify-between items-center">
                       <p className="text-[9px] font-black uppercase">Current Balance (Deyn)</p>
                       <p className="text-[12px] font-black">${Math.abs(selectedCustomer.wallet_balance).toFixed(2)}</p>
                    </div>
                    <div className="flex justify-between items-center mt-1 pt-0.5 opacity-70">
                       <p className="text-[8px] font-bold italic">Equivalent (SLSH):</p>
                       <p className="text-[9px] font-black">{(Math.abs(selectedCustomer.wallet_balance) * exchangeRate).toLocaleString()} SH</p>
                    </div>
                 </div>
              </div>

              <div className="text-center mt-3 pt-1 border-t border-dashed border-black">
                 <p className="text-[8px] italic font-bold">*** Mahadsanid / Thank You ***</p>
                 {(() => {
                    if (!tenantSettings?.receipt_footer) return null;
                    try {
                       const parsedFooter = JSON.parse(tenantSettings.receipt_footer);
                       if (parsedFooter.email) {
                          return <p className="text-[7px] font-semibold text-zinc-500 mt-0.5">Email: {parsedFooter.email}</p>;
                       }
                    } catch (e) {}
                    return null;
                 })()}
                 <p className="text-[7px] font-bold uppercase mt-1 opacity-50">Powered by Dukaan Pro</p>
              </div>
          </div>
        </div>
      )}

      {/* --- ALL UI ELEMENTS (Hidden during print) --- */}
      <div className="print:hidden space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
             <h2 className="text-3xl font-bold tracking-tight text-[#141b2d]">{t('customers')}</h2>
             <p className="text-zinc-500 mt-1">Manage your store's customer database.</p>
          </div>
          <div className="flex gap-3">
            <Button 
               onClick={() => setIsImportOpen(true)}
               disabled={isLoading || !tenantId}
               variant="outline"
               className="border-zinc-200 text-[#141b2d] bg-white rounded-xl shadow-sm hover:bg-zinc-50 h-12 px-4 font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="mr-2 h-5 w-5 text-emerald-600" />
              {lang === 'en' ? 'Import QuickBooks' : 'Soo Geli QuickBooks'}
            </Button>
            <Button 
               onClick={handleOpenAdd}
               disabled={isLoading || !tenantId}
               className="bg-[#141b2d] hover:bg-[#1f2945] text-white rounded-xl shadow-md h-12 px-6 transition-all active:scale-95 disabled:opacity-50"
            >
               <PlusCircle className="mr-2 h-5 w-5" /> Add Customer
            </Button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input 
                placeholder={lang === 'en' ? "Search by Name, Phone, Email..." : "Ku raadi Magac, Taleefoon, iwm..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-[#f9f9fb] border-zinc-200 rounded-xl"
              />
            </div>
        </div>

        <div className="grid gap-4">
        {isLoading ? (
           <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-zinc-100 shadow-sm">
             <div className="h-10 w-10 border-4 border-[#141b2d] border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-zinc-500 font-bold tracking-tight">Loading Premium Customer Data...</p>
           </div>
         ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200 text-zinc-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">{lang === 'en' ? `No results for "${searchQuery}"` : `Wax natiijo ah looma helin "${searchQuery}"`}</p>
            </div>
         ) : (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f9f9fb] border-b border-zinc-100">
                  <th className="px-6 py-4 text-[11px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Customer Profile' : 'Suraadda Macmiilka'}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Contact' : 'Xiriirka'}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Balance / Debt' : 'Deynta'}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Total Spent' : 'Iibka Guud'}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-zinc-400 uppercase tracking-widest text-right">{lang === 'en' ? 'Actions' : 'Waxqabad'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredCustomers.map((c) => {
                  const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const colors = ['bg-blue-100 text-blue-600', 'bg-purple-100 text-purple-600', 'bg-emerald-100 text-emerald-600', 'bg-orange-100 text-orange-600', 'bg-pink-100 text-pink-600'];
                  const colorClass = colors[c.name.length % colors.length];

                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => handleOpenProfile(c)}
                      className="hover:bg-zinc-50/80 transition-all cursor-pointer group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-4">
                          <div className={`h-11 w-11 ${colorClass} rounded-2xl flex items-center justify-center font-black text-sm shadow-sm`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-black text-[#141b2d] group-hover:text-blue-600 transition-colors uppercase text-sm tracking-tight">{c.name}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{c.address || 'Address Not Set'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center text-xs font-bold text-[#141b2d]">
                            <Phone className="h-3 w-3 mr-1.5 text-zinc-400" />
                            {c.phone || 'No Phone'}
                          </div>
                          {c.email && (
                            <div className="flex items-center text-[10px] text-zinc-400 font-medium">
                              <Mail className="h-2.5 w-2.5 mr-1.5" />
                              {c.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`inline-flex items-center px-3 py-1.5 rounded-xl border ${c.wallet_balance < 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                          <Wallet className="h-3 w-3 mr-1.5" />
                          <span className="font-black text-sm">
                            {c.wallet_balance < 0 ? `-$${Math.abs(c.wallet_balance).toFixed(2)}` : `$${c.wallet_balance.toFixed(2)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-black text-[#141b2d] text-sm">
                        {c.spent}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                          {c.phone && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (c.phone) {
                                  window.open(`https://wa.me/${c.phone.replace(/\s+/g, '')}`, '_blank');
                                }
                              }}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 bg-[#f4f7fe] text-blue-600 hover:bg-blue-100 rounded-xl"
                            onClick={(e) => {
                               e.stopPropagation();
                               handleOpenProfile(c);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
         )}
        </div>
      </div>

      {/* --- CUSTOMER PROFILE & PAYMENT DIALOG --- */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
         <DialogContent className="w-[95vw] sm:max-w-[550px] md:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white border-zinc-200 p-0 shadow-2xl custom-scrollbar">
            {selectedCustomer && (
              <>
                {/* Header Section */}
                <div className="bg-[#141b2d] p-5 sm:p-8 text-white print:hidden">
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center space-x-4">
                         <div className="h-20 w-20 bg-white/10 rounded-3xl flex items-center justify-center text-white backdrop-blur-sm border border-white/10">
                            <Users className="h-10 w-10" />
                         </div>
                         <div>
                            <h2 className="text-3xl font-black">{selectedCustomer.name}</h2>
                            <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">Customer Profile / Suraadda Macmiilka</p>
                         </div>
                      </div>
                      <Button variant="ghost" onClick={handlePrintStatement} className="text-white hover:bg-white/10 h-12 w-12 rounded-2xl print:hidden">
                         <Printer className="h-5 w-5"/>
                      </Button>
                   </div>
 
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm pointer-events-none">
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Balance / Haraaga</p>
                         <p className={`text-2xl font-black ${selectedCustomer.wallet_balance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            ${selectedCustomer.wallet_balance.toFixed(2)}
                         </p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Spent / Iibka</p>
                         <p className="text-2xl font-black">{selectedCustomer.spent}</p>
                      </div>
                   </div>
                </div>
 
                {/* Edit & Payment Section */}
                <div className="p-5 sm:p-8 space-y-4 sm:space-y-6 print:hidden">
                   {/* Fields */}
                   <div className="grid gap-4">
                      <div className="grid gap-1.5">
                         <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Magaca Macmiilka</label>
                         <Input 
                            value={selectedCustomer.name} 
                            onChange={(e) => setSelectedCustomer({...selectedCustomer, name: e.target.value})}
                            className="bg-[#f9f9fb] h-12 border-zinc-200 text-[#141b2d] font-bold rounded-xl"
                         />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                           <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Taleefanka</label>
                           <Input 
                              value={selectedCustomer.phone || ""} 
                              onChange={(e) => setSelectedCustomer({...selectedCustomer, phone: e.target.value})}
                              className="bg-[#f9f9fb] h-12 border-zinc-200 text-[#141b2d] font-bold rounded-xl"
                           />
                        </div>
                        <div className="grid gap-1.5">
                           <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Adress-ka</label>
                           <Input 
                              value={selectedCustomer.address || ""} 
                              onChange={(e) => setSelectedCustomer({...selectedCustomer, address: e.target.value})}
                              className="bg-[#f9f9fb] h-12 border-zinc-200 text-[#141b2d] font-bold rounded-xl"
                           />
                        </div>
                      </div>
                   </div>

                   {/* Payment Section */}
                   {selectedCustomer.wallet_balance < 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-3xl p-6">
                        <h4 className="text-red-700 font-black text-sm uppercase mb-4 flex items-center">
                           <CreditCard className="h-4 w-4 mr-2"/> Lacag Qabasho (Receive Debt Payment)
                        </h4>
                        <div className="flex flex-col gap-3">
                           <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-red-400 uppercase ml-2">USD Amount ($)</label>
                                 <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={paymentAmount}
                                    onChange={(e) => handleUSDChange(e.target.value)}
                                    className="bg-white border-red-200 h-12 rounded-xl text-[#141b2d] font-bold"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-red-400 uppercase ml-2">SLSH Amount (Sh)</label>
                                 <Input 
                                    type="number" 
                                    placeholder="0" 
                                    value={paymentAmountSLSH}
                                    onChange={(e) => handleSLSHChange(e.target.value)}
                                    className="bg-white border-red-200 h-12 rounded-xl text-red-700 font-black"
                                 />
                              </div>
                           </div>
                           
                           <div className="flex gap-3">
                              <select 
                                 value={paymentMethod}
                                 onChange={(e) => setPaymentMethod(e.target.value)}
                                 className="flex-1 bg-white border border-red-200 h-12 rounded-xl text-[#141b2d] font-bold px-3 text-sm"
                              >
                                 <option value="cash_usd">Cash (USD)</option>
                                 <option value="cash_slsh">Cash (SLSH)</option>
                                 <option value="zaad">ZAAD</option>
                                 <option value="edahab">eDahab</option>
                              </select>
                              <Button onClick={handlePayDebt} className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all">
                                 Pay / Bixi
                              </Button>
                           </div>
                        </div>
                      </div>
                   )}

                   <div className="grid grid-cols-3 gap-3">
                      <Button onClick={handleUpdate} className="col-span-2 h-14 bg-[#141b2d] hover:bg-black text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all">
                         Save Changes / Bedel
                      </Button>
                      <Button variant="outline" onClick={() => setIsProfileOpen(false)} className="h-14 border-zinc-200 text-zinc-500 font-bold rounded-2xl hover:bg-zinc-50 transition-all">
                         Close
                      </Button>
                   </div>
                   <div className="pt-4 mt-2 border-t border-red-100 border-dashed">
                      <Button 
                         variant="ghost" 
                         onClick={() => {
                            handleDelete(selectedCustomer.id, selectedCustomer.name);
                            setIsProfileOpen(false);
                         }} 
                         className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 font-bold h-12 rounded-xl"
                      >
                         <Trash2 className="h-4 w-4 mr-2" /> Xir / Delete Profile
                      </Button>
                   </div>
                </div>
              </>
            )}
         </DialogContent>
      </Dialog>

      {/* --- ADD CUSTOMER DIALOG --- */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#141b2d]">New Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600">Full Name *</label>
              <Input 
                 placeholder="John Doe"
                 className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                 value={formData.name}
                 onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600">Phone Number</label>
              <Input 
                 placeholder="+252 61..."
                 className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                 value={formData.phone}
                 onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600">Email Address (Optional)</label>
              <Input 
                 type="email"
                 placeholder="customer@example.com"
                 className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                 value={formData.email}
                 onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600">Address / City</label>
              <Input 
                 placeholder="Mogadishu, Somalia"
                 className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                 value={formData.address}
                 onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)} className="rounded-xl h-11">Cancel</Button>
            <Button type="button" onClick={handleAddSubmit} className="bg-[#141b2d] hover:bg-[#1f2945] text-white rounded-xl h-11 px-6">Save Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImporter 
         type="customers"
         tenantId={tenantId || ''}
         isOpen={isImportOpen}
         onClose={() => setIsImportOpen(false)}
         onComplete={fetchCustomers}
         lang={lang}
      />
    </div>
  );
}
