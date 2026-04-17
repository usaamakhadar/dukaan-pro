'use client';

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { jsPDF } from 'jspdf';
import { toast } from "sonner";

export default function InvoicesPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [sales, setSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [storeName, setStoreName] = useState("Loading...");
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [printMode, setPrintMode] = useState<'receipt'|'invoice'>('receipt');
  const receiptRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [receiptHeight, setReceiptHeight] = useState<string>('auto');
  const [invoiceHeight, setInvoiceHeight] = useState<string>('297mm');

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get Tenant Name
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('tenant_id, tenants(name)')
      .eq('user_id', user.id)
      .single();

    if (roleData) {
      setTenantId(roleData.tenant_id);
      // @ts-ignore
      setStoreName(roleData.tenants?.name || "My Store");

      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', roleData.tenant_id)
        .single();
        
      if (settings) {
          setTenantSettings(settings);
      }

      // Fetch Sales and deeply nested Items 
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id, created_at, subtotal, tax, discount, total_amount, status, payment_method,
          tenant_id,
          customers(name, email),
          sale_items(quantity, unit_price, total_price, products(name))
        `)
        .order('created_at', { ascending: false });

      if (salesData && salesData.length > 0) {
        setSales(salesData);
        setSelectedSale(salesData[0]); // Select latest by default
      }
    }
    setIsLoading(false);
  };

  const filteredSales = sales.filter(sale => 
    sale.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (sale.customers?.name && sale.customers.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    sale.payment_method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrintReceipt = async () => {
    if (!receiptRef.current || !selectedSale) return;
    toast.loading(lang === 'en' ? "Preparing Receipt..." : "Waa la diyaarinayaa (Thermal)...");
    
    // Temporarily ensure it is fully visible before capture
    const el = receiptRef.current;
    
    try {
      const imgData = await toPng(el, { quality: 1, pixelRatio: 3, backgroundColor: '#ffffff' });
      download(imgData, `receipt-${selectedSale.id.slice(0,8)}.png`, 'image/png');
      
      toast.dismiss();
      toast.success(lang === 'en' ? 'Downloaded!' : 'Waa la soo dejiyay!');
    } catch(err) {
      toast.dismiss();
      console.error(err);
      toast.error('Galdaloolo ayaa dhacday (' + (err as Error)?.message + ')');
    }
  };

  const handlePrintInvoice = async () => {
    if (!invoiceRef.current || !selectedSale) return;
    toast.loading(lang === 'en' ? "Preparing A4 PDF..." : "Qaansheegta (A4 PDF) waa la diyaarinayaa...");
    
    const el = invoiceRef.current;
    const oldLeft = el.style.left;
    const oldTop = el.style.top;
    
    // Bring it to the screen temporarily for render
    el.style.left = '0';
    el.style.top = '0';
    el.style.position = 'fixed';
    el.style.zIndex = '-9999';

    try {
      const imgData = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
      
      const tempImg = new Image();
      tempImg.src = imgData;
      await new Promise(resolve => tempImg.onload = resolve);

      const pdf = new jsPDF({
         orientation: 'portrait',
         unit: 'mm',
         format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (tempImg.height * pdfWidth) / tempImg.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`invoice-${selectedSale.id.slice(0,8)}.pdf`);
      
      toast.dismiss();
      toast.success(lang === 'en' ? 'PDF Downloaded!' : 'PDF waa la kaydiyay!');
    } catch(err) {
      console.error(err);
      toast.dismiss();
      toast.error('Galdaloolo ayaa dhacday (' + (err as Error)?.message + ')');
    } finally {
      // Restore
      el.style.left = oldLeft;
      el.style.top = oldTop;
      el.style.position = 'absolute';
    }
  };

  const getPaymentName = (pm: string) => {
    switch (pm) {
      case 'zaad': return 'ZAAD Service';
      case 'edahab': return 'eDahab';
      case 'evc_plus': return 'EVC Plus';
      case 'cash_usd': return 'Cash (USD)';
      case 'cash_slsh': return 'Cash (SLSH)';
      default: return pm.replace('_', ' ').toUpperCase();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141b2d]">{lang === 'en' ? 'Invoices & Receipts' : 'Qaansheegta & Rasiidhada'}</h2>
          <p className="text-zinc-500 mt-1">{lang === 'en' ? 'Review past sales and generate PDFs.' : 'Dib u eeg iibki hore oo billal (PDF) soo saar.'}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left List of Sales */}
        <div className="md:col-span-1 space-y-4 max-h-[800px] overflow-y-auto pr-2 print:hidden">
           <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder={lang === 'en' ? "Search Invoice..." : "Raadi Bill..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#0b132b]/20"
            />
          </div>
          {isLoading ? (
            <div className="text-center p-4 text-zinc-500">Loading Invoices...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center p-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-500 text-sm">
              {searchQuery ? `No results for "${searchQuery}"` : "No sales found. Process a sale in POS first!"}
            </div>
          ) : filteredSales.map(sale => (
            <div 
              key={sale.id} 
              onClick={() => setSelectedSale(sale)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedSale?.id === sale.id ? 'bg-[#141b2d] border-[#141b2d] text-white shadow-md' : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300 hover:shadow-sm'}`}
            >
               <div className="flex justify-between items-start mb-2">
                 <p className="font-bold text-sm">INV-{sale.id.slice(0,6).toUpperCase()}</p>
                 <p className="font-extrabold">${sale.total_amount.toFixed(2)}</p>
               </div>
               <div className={`text-xs ${selectedSale?.id === sale.id ? 'text-zinc-300' : 'text-zinc-500'} flex justify-between`}>
                 <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                 <span className="font-bold">{getPaymentName(sale.payment_method)}</span>
               </div>
            </div>
          ))}
        </div>

        {/* Right Preview */}
        <div className="md:col-span-2 space-y-6">

          {selectedSale ? (
            <>
               {/* ----------------- THERMAL RECEIPT ----------------- */}
               <Card ref={receiptRef} className={`bg-white text-[#141b2d] border border-zinc-200 shadow-2xl relative overflow-hidden font-mono text-[12px] mx-auto w-full max-w-[340px]`}>
                 <div className="p-5">
                     {/* Thermal Header */}
                     <div className="text-center space-y-0.5 mb-4">
                        <p className="font-bold text-[10px] uppercase">Sales Receipt #{selectedSale.id.slice(0, 8).toUpperCase()}</p>
                        <div className="flex justify-between text-[10px] border-b border-zinc-100 pb-1 mb-1 font-bold">
                           <span>{new Date(selectedSale.created_at).toLocaleDateString()}</span>
                           <span>{new Date(selectedSale.created_at).toLocaleTimeString()}</span>
                        </div>
                        <h2 className="text-lg font-black uppercase leading-tight mt-1">{storeName || "DKN STORE"}</h2>
                        {tenantSettings?.receipt_header && typeof tenantSettings.receipt_header === 'string' && !tenantSettings.receipt_header.includes('{') ? (
                           <p className="text-[10px] font-medium leading-tight whitespace-pre-wrap">{tenantSettings.receipt_header}</p>
                        ) : (
                           <>
                              <p className="text-[10px] font-medium leading-tight">Mogadishu, Somalia</p>
                              <p className="text-[10px] font-medium">Tel: Update in Settings</p>
                           </>
                        )}
                     </div>

                     {/* Table Header */}
                     <div className="flex justify-between border-y border-black py-1 font-black text-[11px] mb-2 uppercase">
                        <span className="w-1/2 text-left">Magaca Shayga</span>
                        <span className="w-1/6 text-center">Qty</span>
                        <span className="w-1/6 text-right">Price</span>
                        <span className="w-1/6 text-right">Amount</span>
                     </div>

                     {/* Items */}
                     <div className="space-y-1 mb-4 border-b border-zinc-100 pb-2">
                        {selectedSale.sale_items?.map((it: any, idx: number) => (
                           <div key={idx} className="flex justify-between items-start leading-tight">
                              <span className="w-1/2 text-left font-bold uppercase text-[10px]">{it.products?.name || "Product"}</span>
                              <span className="w-1/6 text-center">{it.quantity}</span>
                              <span className="w-1/6 text-right">${parseFloat(it.unit_price).toFixed(2)}</span>
                              <span className="w-1/6 text-right font-bold">${parseFloat(it.total_price).toFixed(2)}</span>
                           </div>
                        ))}
                     </div>

                     {/* Totals */}
                     <div className="space-y-0.5 border-b border-black pb-2 mb-2">
                        <div className="flex justify-between">
                           <span className="font-bold">Subtotal:</span>
                           <span>${parseFloat(selectedSale.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                           <span>Local Sales Tax (0%):</span>
                           <span>+ $0.00</span>
                        </div>
                        <div className="flex justify-between font-black text-[14px] mt-1 pt-1 border-t border-zinc-100">
                           <span>RECEIPT TOTAL:</span>
                           <span>${parseFloat(selectedSale.total_amount).toFixed(2)}</span>
                        </div>
                     </div>

                     {/* Payment */}
                     <div className="mb-4">
                        <p className="font-black text-[13px] uppercase">{getPaymentName(selectedSale.payment_method)}: ${parseFloat(selectedSale.total_amount).toFixed(2)}</p>
                     </div>

                     {/* Footer Message */}
                     <div className="text-center space-y-1">
                        {tenantSettings?.receipt_footer && typeof tenantSettings.receipt_footer === 'string' && !tenantSettings.receipt_footer.includes('{') ? (
                           <p className="italic text-[10px] font-bold whitespace-pre-wrap">{tenantSettings.receipt_footer}</p>
                        ) : (
                           <p className="italic text-[10px] font-bold">Hubso Alaabtaada intaanad bixin / Thank You</p>
                        )}
                        
                        {/* Dynamic Barcode Placeholder */}
                        <div className="flex flex-col items-center pt-2">
                           <div className="w-full h-10 bg-zinc-50 border-x-2 border-black flex items-center justify-center relative">
                              <div className="absolute inset-x-0 top-0 bottom-0 flex justify-between px-1 opacity-20">
                                 {[...Array(20)].map((_, i) => (
                                    <div key={i} className={`w-[1px] bg-black h-full ${i % 3 === 0 ? 'w-[2px]' : ''}`}></div>
                                 ))}
                              </div>
                              <span className="bg-white/80 px-2 text-[10px] font-black z-10">{selectedSale.id.slice(0, 8).toUpperCase()}</span>
                           </div>
                        </div>
                     </div>
                 </div>
               </Card>

               {/* ----------------- A4 INVOICE (RENDERED OFF-SCREEN SO HEIGHT CAN BE CALCULATED) ----------------- */}
               <div ref={invoiceRef} className="absolute top-[-9999px] left-[-9999px] bg-white text-[#141b2d] font-sans p-12 w-[210mm] mx-auto flex-col justify-between" style={{ opacity: 1, display: 'flex' }}>
                  <div>
                     <div className="flex justify-between items-start border-b-2 border-[#141b2d] pb-8 mb-8">
                     <div>
                        <h1 className="text-4xl font-black uppercase text-[#141b2d] tracking-widest leading-none mb-2">INVOICE</h1>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm text-blue-600">#{selectedSale.id.slice(0,8).toUpperCase()}</p>
                     </div>
                     <div className="text-right">
                        <h2 className="text-2xl font-black uppercase">{storeName || "DKN STORE"}</h2>
                        <p className="text-sm text-zinc-500 mt-1">{typeof tenantSettings?.receipt_header === 'string' && !tenantSettings.receipt_header.includes('{') ? tenantSettings.receipt_header : 'Mogadishu, Somalia'}</p>
                        <p className="text-sm text-zinc-500">{new Date(selectedSale.created_at).toLocaleDateString()}</p>
                     </div>
                  </div>

                  <div className="flex justify-between mb-10">
                     <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 min-w-[250px]">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'BILLED TO' : 'LOOGU TALAGALAY'}</p>
                        <h3 className="text-lg font-bold">{selectedSale.customers?.name || (lang === 'en' ? "Walk-In Customer" : "Macmiil Magac La'aan")}</h3>
                        {selectedSale.customers?.email && <p className="text-sm text-zinc-500">{selectedSale.customers.email}</p>}
                     </div>
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 min-w-[200px] text-right">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'PAYMENT METHOD' : 'CASHKA'}</p>
                        <h3 className="text-lg font-bold text-blue-900 uppercase">{getPaymentName(selectedSale.payment_method)}</h3>
                        <p className="text-sm text-blue-600 font-bold">{saleStatus(selectedSale.status)}</p>
                     </div>
                  </div>

                  <table className="w-full text-left mb-10 border-collapse">
                     <thead>
                        <tr className="border-b-2 border-zinc-200">
                           <th className="py-3 font-black text-[12px] uppercase tracking-wider text-zinc-500">{lang === 'en' ? 'Description' : 'Magaca Shayga'}</th>
                           <th className="py-3 font-black text-[12px] uppercase tracking-wider text-zinc-500 text-center">QTY</th>
                           <th className="py-3 font-black text-[12px] uppercase tracking-wider text-zinc-500 text-right">Unit Price</th>
                           <th className="py-3 font-black text-[12px] uppercase tracking-wider text-zinc-500 text-right">Total</th>
                        </tr>
                     </thead>
                     <tbody>
                        {selectedSale.sale_items?.map((it: any, idx: number) => (
                           <tr key={idx} className="border-b border-zinc-100">
                              <td className="py-4 font-bold text-[#141b2d]">{it.products?.name}</td>
                              <td className="py-4 text-center font-bold text-zinc-600">{it.quantity}</td>
                              <td className="py-4 text-right font-medium text-zinc-600">${parseFloat(it.unit_price).toFixed(2)}</td>
                              <td className="py-4 text-right font-black text-[#141b2d]">${parseFloat(it.total_price).toFixed(2)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>

                  <div className="flex justify-end">
                     <div className="w-[300px] space-y-3 bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                        <div className="flex justify-between text-sm font-bold text-zinc-500">
                           <span>Subtotal:</span>
                           <span>${parseFloat(selectedSale.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-zinc-500">
                           <span>Tax (0%):</span>
                           <span>$0.00</span>
                        </div>
                        <div className="border-t border-zinc-200 pt-3 flex justify-between items-center mt-3">
                           <span className="font-black text-lg uppercase tracking-wide">TOTAL DUE</span>
                           <span className="font-black text-2xl text-blue-600">${parseFloat(selectedSale.total_amount).toFixed(2)}</span>
                        </div>
                     </div>
                  </div>
                  </div>

                  <div className="mt-20 pt-8 border-t border-zinc-200 text-center text-sm font-bold text-zinc-400">
                     <p>{typeof tenantSettings?.receipt_footer === 'string' && !tenantSettings.receipt_footer.includes('{') ? tenantSettings.receipt_footer : 'Thank you for your business!'}</p>
                     <p className="mt-1 opacity-50">Generated by DUKAAN PRO SYSTEM</p>
                  </div>
               </div>

            </>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center bg-zinc-50 border border-zinc-200 border-dashed rounded-3xl text-zinc-400 font-medium print:hidden">
              Select an invoice from the list to preview
            </div>
          )}

          {/* Action Panel */}
          {selectedSale && (
            <div className="grid grid-cols-2 gap-4 print:hidden">
               <Button className="w-full bg-[#141b2d] hover:bg-[#1f2945] text-white rounded-xl h-14 text-md font-bold shadow-xl shadow-[#141b2d]/10 active:scale-[0.98] transition-all" onClick={handlePrintReceipt}>
                 <Printer className="mr-3 h-5 w-5" /> {lang === 'en' ? 'Print Receipt' : 'Daabac Rasiidhka (Thermal)'}
               </Button>
               <Button className="w-full h-14 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-md font-bold active:scale-[0.98] transition-all shadow-md" onClick={handlePrintInvoice}>
                 <Download className="mr-3 h-5 w-5" /> {lang === 'en' ? 'Download A4 PDF' : 'Soo deji Invoice PDF'}
               </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function saleStatus(status: string) {
    if (status === 'completed') return lang === 'en' ? 'PAID' : 'WAA LA BIXIYAY';
    if (status === 'debt') return lang === 'en' ? 'UNPAID DEBT' : 'WAA DEYN';
    return status.toUpperCase();
  }
}
