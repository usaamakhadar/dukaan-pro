'use client';

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Wallet, PlusCircle, Trash2, Calendar, Tags, 
  ArrowDownCircle, Home, Users, Zap, Wrench, 
  Briefcase, ShoppingCart, ShoppingBag, MoreHorizontal,
  TrendingDown, Clock, Search, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Expense = { 
  id: string; 
  category: string; 
  amount: number; 
  description: string; 
  expense_date: string;
};

export default function ExpensesPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });

  const categories = [
    { name: "Rent", som: "Kirada", icon: Home, color: "bg-blue-100 text-blue-600" },
    { name: "Salary", som: "Mushaharka", icon: Users, color: "bg-purple-100 text-purple-600" },
    { name: "Utilities", som: "Biyo/Koronto", icon: Zap, color: "bg-orange-100 text-orange-600" },
    { name: "Maintenance", som: "Hagaajin", icon: Wrench, color: "bg-emerald-100 text-emerald-600" },
    { name: "Purchases", som: "Alaab-Iibsi", icon: ShoppingCart, color: "bg-pink-100 text-pink-600" },
    { name: "Marketing", som: "Xayeysiis", icon: Briefcase, color: "bg-indigo-100 text-indigo-600" },
    { name: "Other", som: "Kuwo Kale", icon: MoreHorizontal, color: "bg-zinc-100 text-zinc-600" },
  ];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (roleData) {
      setTenantId(roleData.tenant_id);
      const { data: expData } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (expData) setExpenses(expData as Expense[]);
    }
    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setFormData({ id: '', category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setFormData({ 
      id: exp.id, 
      category: exp.category, 
      amount: exp.amount.toString(), 
      description: exp.description || '', 
      expense_date: exp.expense_date 
    });
    setIsEditOpen(true);
  };

  const handleAddSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!tenantId || !userId) return;
    if (!formData.category || !formData.amount) {
      toast.error(lang === 'en' ? "Category & Amount are required. ⚠️" : "Nooca & Lacagtu waa in la buuxiyaa. ⚠️");
      return;
    }
    const expenseData = {
      tenant_id: tenantId,
      user_id: userId,
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      expense_date: formData.expense_date,
    };
    const { data, error } = await supabase.from('expenses').insert([expenseData]).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setExpenses((prev) => [data as Expense, ...prev]);
    setIsAddOpen(false);
    toast.success(lang === 'en' ? "Expense recorded! 💸" : "Kharashka waa la diiwaangaliyay! 💸");
  };

  const handleEditSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) {
      toast.error(lang === 'en' ? "Category & Amount are required. ⚠️" : "Nooca & Lacagtu waa in la buuxiyaa. ⚠️");
      return;
    }
    const { error } = await supabase
      .from('expenses')
      .update({
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        expense_date: formData.expense_date,
      })
      .eq('id', formData.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setExpenses(prev => prev.map(ex => ex.id === formData.id ? { 
      ...ex, 
      category: formData.category, 
      amount: parseFloat(formData.amount), 
      description: formData.description,
      expense_date: formData.expense_date 
    } : ex));
    
    setIsEditOpen(false);
    toast.success(lang === 'en' ? "Expense updated!" : "Kharashka waa la bedelay!");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(lang === 'en' ? "Delete expense?" : "Ma hubtaa inaad tirtirto kharashkan?")) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (!error) {
        setExpenses(prev => prev.filter(c => c.id !== id));
        toast.success(lang === 'en' ? "Expense deleted!" : "Wa la tirtiray!");
      } else { toast.error(error.message); }
    }
  };

  const filteredExpenses = expenses.filter(ex => 
    ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalExpenses = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const thisMonthExpenses = expenses
    .filter(ex => new Date(ex.expense_date).getMonth() === new Date().getMonth())
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
  const todayExpenses = expenses
    .filter(ex => new Date(ex.expense_date).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const getCategoryIcon = (catName: string) => {
    const cat = categories.find(c => c.name === catName) || categories[categories.length - 1];
    return { Icon: cat.icon, color: cat.color };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h2 className="text-3xl font-black tracking-tight text-[#141b2d] uppercase">{lang === 'en' ? 'Expenses Manager' : 'Maamulka Kharashka'}</h2>
           <p className="text-zinc-500 font-medium mt-1">{lang === 'en' ? "Track and optimize your business operation costs." : "Raac oo xisaabi dhammaan kharashaadka dukaanka (Gool-ka)."}</p>
        </div>
        <Button 
           onClick={handleOpenAdd}
           disabled={isLoading || !tenantId}
           className="bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-xl shadow-red-100 h-14 px-8 font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
           <PlusCircle className="mr-2 h-5 w-5" /> {lang === 'en' ? 'Record Expense' : 'Diiwaangali Kharash'}
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
         <Card className="bg-white border-zinc-100 shadow-xl shadow-zinc-100/50 rounded-3xl overflow-hidden border-b-4 border-b-red-500">
            <CardContent className="p-8">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'Total Expenses' : 'Kharashka Guud'}</p>
                    <h3 className="text-3xl font-black text-[#141b2d]">${totalExpenses.toFixed(2)}</h3>
                  </div>
                  <div className="h-14 w-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                     <ArrowDownCircle className="h-8 w-8" />
                  </div>
               </div>
            </CardContent>
         </Card>
         <Card className="bg-white border-zinc-100 shadow-xl shadow-zinc-100/50 rounded-3xl overflow-hidden border-b-4 border-b-orange-500">
            <CardContent className="p-8">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'This Month' : 'Bishan'}</p>
                    <h3 className="text-3xl font-black text-[#141b2d]">${thisMonthExpenses.toFixed(2)}</h3>
                  </div>
                  <div className="h-14 w-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                     <TrendingDown className="h-8 w-8" />
                  </div>
               </div>
            </CardContent>
         </Card>
         <Card className="bg-white border-zinc-100 shadow-xl shadow-zinc-100/50 rounded-3xl overflow-hidden border-b-4 border-b-[#141b2d]">
            <CardContent className="p-8">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'en' ? 'Today' : 'Maanta'}</p>
                    <h3 className="text-3xl font-black text-[#141b2d]">${todayExpenses.toFixed(2)}</h3>
                  </div>
                  <div className="h-14 w-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-[#141b2d]">
                     <Clock className="h-8 w-8" />
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>

      <div className="bg-white border border-zinc-100 rounded-3xl p-4 shadow-xl shadow-zinc-100/50 flex items-center space-x-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input 
              type="text"
              placeholder={lang === 'en' ? "Search by category or description..." : "Ku raadi nooca ama faahfaahinta..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 h-14 bg-[#f9f9fb] border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-red-500/20 transition-all"
            />
          </div>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
           <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-zinc-100 shadow-sm">
             <div className="h-10 w-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-zinc-500 font-bold tracking-tight">Finishing Expenses Records...</p>
           </div>
        ) : filteredExpenses.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200 text-zinc-300">
             <Wallet className="h-16 w-16 mx-auto mb-4 opacity-10" />
             <p className="font-bold uppercase tracking-widest text-xs">No records found / Kharash lama helin</p>
           </div>
        ) : (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f9f9fb] border-b border-zinc-100">
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Category' : 'Nooca'}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Details' : 'Faahfaahin'}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Date' : 'Taariikhda'}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">{lang === 'en' ? 'Amount' : 'Lacagta'}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredExpenses.map((exp) => {
                  const { Icon, color } = getCategoryIcon(exp.category);
                  return (
                    <tr key={exp.id} onClick={() => handleOpenEdit(exp)} className="hover:bg-red-50/30 transition-all group cursor-pointer">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className={`h-11 w-11 ${color} rounded-2xl flex items-center justify-center shadow-sm`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="font-black text-[#141b2d] uppercase text-xs tracking-widest">{lang === 'en' ? exp.category : (categories.find(c => c.name === exp.category)?.som || exp.category)}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-zinc-600 truncate max-w-[200px]">{exp.description || '---'}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center text-xs font-black text-zinc-400">
                          <Calendar className="h-3.5 w-3.5 mr-2" />
                          {new Date(exp.expense_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-lg font-black text-red-600">-${Number(exp.amount).toFixed(2)}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                            <button 
                                className="p-2.5 bg-zinc-50 text-zinc-400 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={(e) => handleDelete(exp.id, e)}
                                className="p-2.5 bg-red-50 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
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

      {/* --- ADD EXPENSE DIALOG --- */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] bg-white border-zinc-200 p-8 shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-[#141b2d] uppercase tracking-tight">{lang === 'en' ? 'New Expense Record' : 'Kharash Cusub'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Category / Nooca *</label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val || ''})}>
                <SelectTrigger className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-sm font-bold">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-zinc-100">
                   {categories.map(cat => (
                      <SelectItem key={cat.name} value={cat.name} className="rounded-xl my-1 font-bold">
                        <div className="flex items-center">
                          <cat.icon className="h-4 w-4 mr-3 text-zinc-400" />
                          {lang === 'en' ? cat.name : cat.som}
                        </div>
                      </SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Amount ($) *</label>
                <Input 
                   type="number"
                   placeholder="0.00"
                   className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-lg font-black text-red-600"
                   value={formData.amount}
                   onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Date *</label>
                <Input 
                   type="date"
                   className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-sm font-bold"
                   value={formData.expense_date}
                   onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Description / Note</label>
              <Input 
                 placeholder={lang === 'en' ? "Short description..." : "Faahfaahin kooban..."}
                 className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-sm font-bold"
                 value={formData.description}
                 onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="mt-10 sm:justify-start gap-3">
            <Button type="button" onClick={handleAddSubmit} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl shadow-red-100">
               {lang === 'en' ? 'Save Record' : 'Kaydi Kharashka'}
            </Button>
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)} className="rounded-2xl h-14 border-zinc-100 px-6 font-bold text-zinc-400">Xir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- EDIT EXPENSE DIALOG --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] bg-white border-zinc-200 p-8 shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-[#141b2d] uppercase tracking-tight">{lang === 'en' ? 'Edit Expense' : 'Wax ka badal Kharash'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Category / Nooca *</label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val || ''})}>
                <SelectTrigger className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-sm font-bold">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-zinc-100">
                   {categories.map(cat => (
                      <SelectItem key={cat.name} value={cat.name} className="rounded-xl my-1 font-bold">
                        <div className="flex items-center">
                          <cat.icon className="h-4 w-4 mr-3 text-zinc-400" />
                          {lang === 'en' ? cat.name : cat.som}
                        </div>
                      </SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Amount ($) *</label>
                <Input 
                   type="number"
                   placeholder="0.00"
                   className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-lg font-black text-red-600"
                   value={formData.amount}
                   onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Date *</label>
                <Input 
                   type="date"
                   className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-sm font-bold"
                   value={formData.expense_date}
                   onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Description / Note</label>
              <Input 
                 placeholder={lang === 'en' ? "Short description..." : "Faahfaahin kooban..."}
                 className="bg-[#f9f9fb] h-14 border-none rounded-2xl px-5 text-sm font-bold"
                 value={formData.description}
                 onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="mt-10 sm:justify-start gap-3">
            <Button type="button" onClick={handleEditSubmit} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl shadow-red-100">
               {lang === 'en' ? 'Update Record' : 'Bedel xogta'}
            </Button>
            <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)} className="rounded-2xl h-14 border-zinc-100 px-6 font-bold text-zinc-400">Xir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
