'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Search, Bell, HelpCircle, LayoutDashboard, ShoppingBag, 
  Receipt, Users, Settings, PackageOpen, X, Check, Eye, Globe, Wallet, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Menu } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();

  // Profile State
  const [storeName, setStoreName] = useState("Loading Store...");
  const [userName, setUserName] = useState("Loading...");
  const [userRole, setUserRole] = useState("...");
  const [profilePic, setProfilePic] = useState("https://i.pravatar.cc/150?u=a042581f4e29026024d");

  // Temporary state for the Edit Dialog
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPic, setEditPic] = useState(profilePic);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Checking user...");
      
      if (user) {
        setUserName(user.email?.split('@')[0] || "User");
        setEditName(user.email?.split('@')[0] || "User");
        setStoreName("Dukaan Pro");
        setUserRole("Admin");
        setProfilePic("https://ui-avatars.com/api/?name=U&background=0b132b&color=fff");
        supabase.auth.updateUser({ data: { avatar_url: null } });
        
        // Logic removed to fix header size
      } else {
        // Redirect if not logged in
        window.location.replace('/login');
      }
    };
    fetchProfile();
  }, []);

  const sidebarLinks = [
    { label: t('dashboard'), href: "/dashboard", icon: LayoutDashboard },
    { label: t('pos'), href: "/pos", icon: ShoppingBag },
    { label: t('inventory'), href: "/dashboard/inventory", icon: PackageOpen },
    { label: t('invoices'), href: "/dashboard/invoices", icon: Receipt },
    { label: t('customers'), href: "/dashboard/customers", icon: Users },
    { label: t('expenses'), href: "/dashboard/expenses", icon: Wallet },
    { label: t('settings'), href: "/dashboard/settings", icon: Settings },
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(lang === 'en' ? "Image too large! Max 2MB." : "Sawirka waa uu weyn yahay! Fadlan keen mid ka yar 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new (window as any).Image();
        img.src = reader.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 100;
          const MAX_HEIGHT = 100;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // Lower quality for metadata safety
          
          if (dataUrl.length > 8000) {
            toast.error(lang === 'en' ? "Image quality too high, try a simpler photo." : "Sawirka waa uu weyn yahay wali, fadlan mid kale isku day.");
            return;
          }
          setEditPic(dataUrl);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setUserName(editName);
    setUserRole(editRole);
    setProfilePic(editPic);
    
    // Save to LocalStorage for instant fallback
    if (typeof window !== "undefined") {
       localStorage.setItem("userName", editName);
       localStorage.setItem("userRole", editRole);
       localStorage.setItem("profilePic", editPic);
    }

    // Persist to Supabase Auth Metadata (ONLY name and role, NO IMAGE)
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { 
        full_name: editName,
        role: editRole,
        // REMOVED avatar_url as it causes 494 Request Header Too Large
      }
    });

    // Also clear it from database if it exists to fix the 494 error for this user
    await supabase.auth.updateUser({
        data: { avatar_url: null }
    });

    if (error) {
      toast.error(lang === 'en' ? "Error saving to cloud" : "Khalad baa ka dhacay kaydinta daruuraha");
    } else {
      setIsDialogOpen(false);
      toast.success(lang === 'en' ? "Profile changed successfully! ✅" : "Xogta si guul leh baa loo badalay! ✅");
    }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'so' : 'en');
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.clear(); // Clear everything
      window.location.replace('/login');
    }
  };

  return (
    <div className="flex h-screen bg-white text-zinc-900 overflow-hidden font-sans print:h-auto print:overflow-visible">
      
      {/* 1. SIDEBAR */}
      <aside className="w-[240px] bg-[#0b132b] text-zinc-400 flex flex-col justify-between hidden md:flex shrink-0 print:hidden">
        <div>
          <div className="p-8 pb-12 cursor-pointer hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-bold text-white tracking-wide truncate pr-4">
              {storeName}
            </h1>
            <p className="text-xs text-zinc-500 font-medium tracking-widest mt-1 uppercase">PREMIUM RETAIL</p>
          </div>
          
          <nav className="px-4 space-y-2">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link href={link.href} key={link.label}>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${
                      isActive 
                        ? "bg-[#182343] text-white font-medium" 
                        : "hover:bg-[#182343]/50 hover:text-white"
                    }`}
                  >
                    <link.icon className="h-5 w-5 mr-4" />
                    {link.label}
                  </button>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-6 space-y-3">
          <Link href="/pos">
            <Button className="w-full bg-[#8fa4cf]/80 hover:bg-[#8fa4cf] text-[#0b132b] font-semibold py-6 rounded-xl shadow-lg transition-transform active:scale-95">
              {t('new_sale')}
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10 justify-start py-6 rounded-xl transition-all"
          >
            <LogOut className="h-5 w-5 mr-4" />
            {lang === 'en' ? 'Logout' : 'Ka bax'}
          </Button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 bg-[#f9f9fb] flex flex-col overflow-hidden print:bg-white print:overflow-visible relative">
        
        {/* Top Header */}
        <header className="h-20 px-4 md:px-8 flex items-center justify-between bg-white border-b border-zinc-200 shrink-0 shadow-sm z-10 relative print:hidden">
          
          <div className="flex items-center flex-1">
            {/* MOBILE MENU TRIGGER */}
            <Sheet>
               <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="md:hidden mr-3">
                       <Menu className="h-6 w-6 text-zinc-600" />
                    </Button>
                  }
               />
               <SheetContent side="left" className="bg-[#0b132b] border-none text-zinc-400 p-0 w-[240px]">
                  <SheetHeader className="p-8 pb-10 text-left border-none">
                     <SheetTitle className="text-xl font-bold text-white tracking-wide">{storeName}</SheetTitle>
                     <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">MOBILE ACCESS</p>
                  </SheetHeader>
                  <nav className="px-4 space-y-2">
                    {sidebarLinks.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link href={link.href} key={link.label}>
                          <button 
                            className={`w-full flex items-center px-4 py-4 rounded-xl transition-all ${
                              isActive 
                                ? "bg-[#182343] text-white font-medium shadow-md" 
                                : "hover:bg-[#182343]/50 hover:text-white"
                            }`}
                          >
                            <link.icon className="h-5 w-5 mr-4" />
                            {link.label}
                          </button>
                        </Link>
                      );
                    })}
                  </nav>
               </SheetContent>
            </Sheet>

            <div className="relative w-full max-w-xs md:max-w-md hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <input 
                type="text" 
                placeholder={t('search_placeholder')}
                className="w-full pl-11 md:pl-12 pr-4 py-2.5 md:py-3 bg-[#eef0f3] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0b132b]/20 text-[#141b2d] placeholder-zinc-500 transition-shadow"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">

             {/* LANGUAGE TOGGLE */}
             <button onClick={toggleLang} className="flex items-center text-xs font-bold text-zinc-500 hover:text-blue-600 transition-colors bg-[#eef0f3] px-3 py-1.5 rounded-full">
               <Globe className="h-4 w-4 mr-2" />
               {lang === 'en' ? 'EN' : 'SO'}
             </button>
            
            {/* NOTIFICATION DROP-DOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger className="relative cursor-pointer text-zinc-500 hover:text-zinc-800 transition-colors focus:outline-none">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg">
                <div className="px-2 py-1.5 text-sm font-semibold text-zinc-900">{t('notifications')}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                   🟢 Sneaker Pro stock is low
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                   💰 New Sale #INV-102: $425.00
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* HELP DROP-DOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger className="cursor-pointer text-zinc-500 hover:text-zinc-800 transition-colors focus:outline-none">
                  <HelpCircle className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                <div className="px-2 py-1.5 text-sm font-semibold text-zinc-900">{t('help')}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer"><Receipt className="mr-2 h-4 w-4"/> Docs</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer"><Users className="mr-2 h-4 w-4"/> Support</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* PROFILE DIRECT EDIT (DIALOG) */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger className="flex items-center border-l border-zinc-200 pl-4 md:pl-6 space-x-2 md:space-x-3 cursor-pointer group focus:outline-none bg-transparent border-none text-left p-0">
                  <div className="text-right transition-colors group-hover:text-blue-600 hidden sm:block">
                    <p className="text-sm font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors uppercase">{userName}</p>
                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">{userRole === 'STORE MANAGER' && lang === 'so' ? t('store_manager') : userRole}</p>
                  </div>
                  <div className="h-9 w-9 md:h-10 md:w-10 bg-zinc-300 rounded-full overflow-hidden border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-blue-100 transition-all">
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover"/>
                  </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white border-zinc-200">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-[#141b2d]">{t('edit_profile')}</DialogTitle>
                  <DialogDescription>
                    {t('profile_instructions')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="flex items-center justify-center mb-2">
                    <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-[#f9f9fb] shadow-md relative group">
                      <img src={editPic} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Eye className="text-white h-6 w-6" />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-[#141b2d]">{t('new_name')}</label>
                    <Input 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-[#f9f9fb] h-12"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-[#141b2d]">{t('role')}</label>
                    <Input 
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="bg-[#f9f9fb] h-12"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-[#141b2d]">{t('upload_picture')}</label>
                    <Input 
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="bg-[#f9f9fb] h-12 pt-2.5 cursor-pointer file:text-[#141b2d] file:font-semibold file:border-none file:mr-2 file:bg-transparent file:cursor-pointer"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-12 rounded-xl">{t('cancel')}</Button>
                  <Button onClick={handleSaveProfile} className="h-12 bg-[#141b2d] hover:bg-[#1f2945] rounded-xl px-8">{t('save_changes')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 print:overflow-visible print:bg-white print:p-0">
          {children}
        </main>
      </div>

    </div>
  );
}
