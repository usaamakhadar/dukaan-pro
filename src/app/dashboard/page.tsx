'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Percent, TrendingUp, Users, Wallet, PackageOpen } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

export default function DashboardOverview() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    revenue: 0,
    expenses: 0,
    customersCount: 0,
    productsCount: 0,
    todaysSales: 0
  });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [lang]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user || null;
    }
    if (!user) return;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (roleData) {
      // 1. Revenue
      const { data: sales } = await supabase.from('sales').select('total_amount, created_at');
      const totalRev = sales?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;
      
      const today = new Date().toISOString().split('T')[0];
      const todayRev = sales?.filter(s => s.created_at.startsWith(today)).reduce((a, b) => a + Number(b.total_amount), 0) || 0;

      // 2. Expenses
      const { data: expenses } = await supabase.from('expenses').select('amount, expense_date');
      const totalExp = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      // 3. Customers Count
      const { count: customersCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });

      // 4. Products Count
      const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });

      setMetrics({
        revenue: totalRev,
        expenses: totalExp,
        customersCount: customersCount || 0,
        productsCount: productsCount || 0,
        todaysSales: todayRev
      });

      // 5. Chart Data (Group by last 7 days)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const chartDataMap: Record<string, {sales: number, expenses: number}> = {};
      last7Days.forEach(date => chartDataMap[date] = { sales: 0, expenses: 0 });

      sales?.forEach(s => {
        const d = s.created_at.split('T')[0];
        if (chartDataMap[d]) chartDataMap[d].sales += Number(s.total_amount);
      });

      expenses?.forEach(e => {
        const d = e.expense_date?.split('T')[0];
        if (d && chartDataMap[d]) chartDataMap[d].expenses += Number(e.amount);
      });

      const formattedChartData = last7Days.map(date => ({
        name: new Date(date).toLocaleDateString(lang === 'so' ? 'so-SO' : 'en-US', { weekday: 'short' }),
        sales: chartDataMap[date].sales,
        expenses: chartDataMap[date].expenses
      }));
      setSalesData(formattedChartData);

      // 6. Top Products
      const { data: productsData } = await supabase.from('products').select('name, price, stock').order('created_at', { ascending: false }).limit(3);
      if (productsData) setTopProducts(productsData);
    }
    setIsLoading(false);
  };

  const stats = [
    { title: lang === 'en' ? 'Total Revenue' : 'Dakhliga Iibka', value: `$${metrics.revenue.toFixed(2)}`, icon: DollarSign, trend: `+$${metrics.todaysSales.toFixed(2)} Today`, pos: true },
    { title: lang === 'en' ? 'Total Expenses' : 'Kharashaadka', value: `$${metrics.expenses.toFixed(2)}`, icon: Wallet, trend: "Outflow", pos: false },
    { title: lang === 'en' ? 'Customers' : 'Macaamiisha', value: metrics.customersCount.toString(), icon: Users, trend: "Registered", pos: true },
    { title: lang === 'en' ? 'Inventory Items' : 'Tirada Alaabaha', value: metrics.productsCount.toString(), icon: PackageOpen, trend: "In Stock", pos: true }
  ];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="mb-2 md:mb-4 flex justify-between items-center">
        <div>
           <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#141b2d]">{t('overview')}</h2>
           <p className="text-sm text-zinc-500 font-medium">{lang === 'en' ? 'Live metrics from your business dashboard.' : 'Muraayada Xogta Shirkadaada (Business Overview).'}</p>
        </div>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-white border-zinc-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] rounded-3xl transition-all hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1 cursor-pointer overflow-hidden relative group">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-4 md:p-5 z-10 relative">
              <CardTitle className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest truncate mr-2">
                {stat.title}
              </CardTitle>
              <div className={`h-8 w-8 md:h-10 md:w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${stat.pos ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                 <stat.icon className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-5 pt-0 md:pt-0 z-10 relative">
              <div className="text-xl md:text-3xl font-black text-[#141b2d] tracking-tight">
                  {isLoading ? "..." : stat.value}
              </div>
              <p className={`text-xs mt-2 font-extrabold flex items-center ${stat.pos ? 'text-blue-600' : 'text-red-600'}`}>
                 <TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" /> {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 mb-4">
        <Card className="lg:col-span-4 bg-white border-zinc-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-zinc-100/50 bg-zinc-50/50 py-3 px-5">
            <CardTitle className="text-[#141b2d] font-extrabold text-lg tracking-tight">{lang === 'en' ? 'Sales vs Expenses' : 'Iibka & Kharashka (7 Cisho)'}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px] md:h-[280px] p-4 pt-4">
            {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 font-medium">Loading Chart...</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#a1a1aa', fontSize: 13, fontWeight: 600}}
                      dy={15}
                    />
                    <YAxis   
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#a1a1aa', fontSize: 13, fontWeight: 600}}
                      tickFormatter={(value) => `$${value}`}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)', padding: '12px 16px' }}
                      labelStyle={{ fontWeight: '900', color: '#141b2d', marginBottom: '8px', fontSize: '14px', textTransform: 'uppercase' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      name={lang === 'en' ? 'Sales' : 'Iibka'}
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorSales)"
                      strokeWidth={4} 
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#3b82f6' }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expenses" 
                      name={lang === 'en' ? 'Expenses' : 'Kharashka'}
                      stroke="#ef4444" 
                      fillOpacity={1} 
                      fill="url(#colorExpenses)"
                      strokeWidth={4} 
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#ef4444' }} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3 bg-white border-zinc-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden flex flex-col h-[335px] md:h-[350px]">
          <CardHeader className="border-b border-zinc-100/50 bg-zinc-50/50 py-3 px-5">
            <CardTitle className="text-[#141b2d] font-extrabold text-lg tracking-tight">{lang === 'en' ? 'Recent Inventory' : 'Alaabta Dambaysay'}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
               <div className="text-zinc-400 font-medium">Loading Products...</div>
            ) : topProducts.length === 0 ? (
               <div className="text-zinc-400 text-sm font-medium">No products found.</div>
            ) : topProducts.map((product, idx) => (
                <div key={idx} className="flex items-center group cursor-pointer p-3 rounded-2xl bg-[#f9f9fb] border border-zinc-100 hover:bg-white hover:border-blue-100 hover:shadow-[0_8px_30px_-5px_rgba(59,130,246,0.15)] transition-all">
                  <div className="h-12 w-12 bg-white rounded-xl overflow-hidden shrink-0 shadow-sm border border-zinc-200 flex items-center justify-center p-0.5">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random&color=fff&size=100&font-size=0.4`} alt="" className="object-cover w-full h-full rounded-lg group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="ml-4 flex-1">
                      <p className="text-sm font-extrabold leading-none text-[#141b2d] mb-1 line-clamp-1">{product.name}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-100 w-max px-2 py-0.5 rounded-full">{product.stock} {lang === 'en' ? 'in stock' : 'kaydka'}</p>
                  </div>
                  <div className="ml-auto font-black text-blue-600 text-lg tracking-tight">${parseFloat(product.price).toFixed(2)}</div>
                </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
