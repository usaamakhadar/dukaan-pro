'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  ShoppingBag, 
  Clock, 
  ArrowRight, 
  RefreshCw,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

export interface NotificationItem {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'recent_sale' | 'debt_alert';
  title: string;
  description: string;
  time?: string;
  href: string;
}

export function NotificationsMenu() {
  const { lang } = useLanguage();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [lang]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const items: NotificationItem[] = [];

      // 1. Fetch Out-of-Stock and Low-Stock Products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock')
        .lte('stock', 5)
        .order('stock', { ascending: true })
        .limit(6);

      if (products && products.length > 0) {
        products.forEach((p: any) => {
          if (p.stock <= 0) {
            items.push({
              id: `oos-${p.id}`,
              type: 'out_of_stock',
              title: lang === 'en' ? 'Out of Stock!' : 'Alaab Dhamatay!',
              description: lang === 'en' 
                ? `${p.name} has 0 stock remaining.` 
                : `${p.name} kaydkiisu gabi ahaanba wuu dhammaaday (0 haray).`,
              href: '/dashboard/inventory'
            });
          } else {
            items.push({
              id: `low-${p.id}`,
              type: 'low_stock',
              title: lang === 'en' ? 'Low Stock Warning' : 'Kaydku wuu Dhamaanayaa',
              description: lang === 'en' 
                ? `${p.name}: only ${p.stock} item(s) left.` 
                : `${p.name}: kaliya ${p.stock} xabbo baa kaydka ku haray.`,
              href: '/dashboard/inventory'
            });
          }
        });
      }

      // 2. Fetch Latest Sales
      const { data: sales } = await supabase
        .from('sales')
        .select('id, total_amount, payment_method, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (sales && sales.length > 0) {
        sales.forEach((s: any) => {
          const saleDate = new Date(s.created_at);
          const timeStr = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isToday = new Date().toDateString() === saleDate.toDateString();
          const displayTime = isToday ? timeStr : saleDate.toLocaleDateString();

          const isDebt = s.payment_method?.toLowerCase().includes('deyn') || s.payment_method?.toLowerCase().includes('debt');

          if (isDebt) {
            items.push({
              id: `debt-${s.id}`,
              type: 'debt_alert',
              title: lang === 'en' ? 'Unpaid Debt Sale' : 'Iib Deyn ah oo Cusub',
              description: lang === 'en'
                ? `Sale $${parseFloat(s.total_amount).toFixed(2)} recorded on credit.`
                : `Iib dhan $${parseFloat(s.total_amount).toFixed(2)} oo deyn ah ayaa dhacay.`,
              time: displayTime,
              href: '/dashboard/customers'
            });
          } else {
            items.push({
              id: `sale-${s.id}`,
              type: 'recent_sale',
              title: lang === 'en' ? 'Recent Sale' : 'Iibkii Ugu Dambeeyay',
              description: lang === 'en'
                ? `$${parseFloat(s.total_amount).toFixed(2)} (${s.payment_method || 'Cash'})`
                : `$${parseFloat(s.total_amount).toFixed(2)} (${s.payment_method || 'Kaash'})`,
              time: displayTime,
              href: '/dashboard/invoices'
            });
          }
        });
      }

      setNotifications(items);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    } finally {
      setIsLoading(false);
    }
  };

  const criticalCount = notifications.filter(n => n.type === 'out_of_stock' || n.type === 'low_stock').length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative cursor-pointer text-zinc-500 hover:text-zinc-800 transition-colors focus:outline-none p-1.5 rounded-full hover:bg-zinc-100">
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black border-2 border-white shadow-xs">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[300px] sm:w-[360px] rounded-2xl shadow-2xl p-0 border border-zinc-100 bg-white overflow-hidden z-50">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0b132b] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide">
              {lang === 'en' ? 'Notifications' : 'Ogeysiisyada'}
            </span>
            {notifications.length > 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                criticalCount > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {notifications.length}
              </span>
            )}
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault();
              fetchNotifications();
            }}
            disabled={isLoading}
            className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            title={lang === 'en' ? 'Refresh notifications' : 'Cusboonaysii ogeysiisyada'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100/80 custom-scrollbar">
          {isLoading && notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 font-medium">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-zinc-400" />
              {lang === 'en' ? 'Loading alerts...' : 'Soo dejinaya ogeysiisyada...'}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-zinc-800">
                {lang === 'en' ? 'All systems clear!' : 'Dhammaan waa hagaag!'}
              </p>
              <p className="text-[11px] text-zinc-400">
                {lang === 'en' ? 'No stock shortages or alerts right now.' : 'Ma jiraan alaabo dhamaaday ama digniino hadda.'}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <Link href={item.href} key={item.id} className="block">
                <DropdownMenuItem className="p-3 sm:p-3.5 flex items-start gap-3 cursor-pointer hover:bg-zinc-50 focus:bg-zinc-50 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {item.type === 'out_of_stock' && (
                      <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                    )}
                    {item.type === 'low_stock' && (
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    )}
                    {item.type === 'recent_sale' && (
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                        <DollarSign className="h-4 w-4" />
                      </div>
                    )}
                    {item.type === 'debt_alert' && (
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs font-black truncate ${
                        item.type === 'out_of_stock' ? 'text-red-600' :
                        item.type === 'low_stock' ? 'text-amber-700' :
                        item.type === 'recent_sale' ? 'text-emerald-700' : 'text-blue-700'
                      }`}>
                        {item.title}
                      </p>
                      {item.time && (
                        <span className="text-[10px] font-bold text-zinc-400 shrink-0">
                          {item.time}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 font-medium leading-tight">
                      {item.description}
                    </p>
                  </div>
                </DropdownMenuItem>
              </Link>
            ))
          )}
        </div>

        {/* Footer Quick Links */}
        <div className="p-2 bg-zinc-50 border-t border-zinc-100 grid grid-cols-2 gap-1.5">
          <Link href="/dashboard/inventory" className="w-full">
            <button className="w-full py-1.5 px-2 rounded-lg text-[10px] font-bold text-zinc-600 hover:text-black hover:bg-zinc-200/60 transition-colors flex items-center justify-center gap-1">
              <span>📦 {lang === 'en' ? 'Inventory' : 'Kaydka'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
          <Link href="/dashboard/invoices" className="w-full">
            <button className="w-full py-1.5 px-2 rounded-lg text-[10px] font-bold text-zinc-600 hover:text-black hover:bg-zinc-200/60 transition-colors flex items-center justify-center gap-1">
              <span>🧾 {lang === 'en' ? 'Invoices' : 'Iibka'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
