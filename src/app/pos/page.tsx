'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, Bell, HelpCircle, LayoutDashboard, ShoppingBag, 
  Receipt, Users, Settings, Plus, Minus, Trash2, Globe, PackageOpen, X, Wallet, Camera, Menu, ShoppingCart, Check, LogOut, RefreshCw
} from "lucide-react";
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
import BarcodeScannerCamera from "@/components/BarcodeScannerCamera";
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { jsPDF } from 'jspdf';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye } from 'lucide-react';

export default function POSPage() {
  const { t, lang, setLang } = useLanguage();
  const supabase = createClient();

  // User & DB State
  const [userName, setUserName] = useState("Loading...");
  const [storeName, setStoreName] = useState("Loading...");
  const [userRole, setUserRole] = useState("STORE MANAGER");
  const [profilePic, setProfilePic] = useState("https://i.pravatar.cc/150?u=a042581f4e29026024d");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [cashierId, setCashierId] = useState<string | null>(null);

  // Profile Edit State
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPic, setEditPic] = useState(profilePic);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Data State
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<{id: string, label: string}[]>([{ id: "All Items", label: t('all_items') || "All Items" }]);
  
  // Checkout State
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Barcode Scanner State
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);

  type CartItem = { id: string, name: string, price: number, image: string, qty: number, stock: number, variant?: string };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const defaultName = user.email?.split('@')[0] || "User";
      const meta = user.user_metadata;
      const storedName = meta.full_name || localStorage.getItem("userName");
      const storedPic = meta.avatar_url || localStorage.getItem("profilePic");
      const storedRole = meta.role || localStorage.getItem("userRole");
      
      setUserName(storedName || defaultName);
      setEditName(storedName || defaultName);
      if (storedPic) {
        if (storedPic.startsWith('data:image')) {
          const defaultPic = "https://ui-avatars.com/api/?name=" + (storedName || "U") + "&background=0b132b&color=fff";
          setProfilePic(defaultPic);
          setEditPic(defaultPic);
          supabase.auth.updateUser({ data: { avatar_url: null } });
        } else {
          setProfilePic(storedPic);
          setEditPic(storedPic);
        }
      }
      setCashierId(user.id);

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('tenant_id, role, tenants(name)')
        .eq('user_id', user.id)
        .single();

      if (roleData) {
        setUserRole(storedRole || roleData.role);
        setTenantId(roleData.tenant_id);
        // @ts-ignore
        setStoreName(roleData.tenants?.name || "");
        
        // Fetch Settings, Products, and Customers in parallel to boost speed dramatically!
        const [settingsRes] = await Promise.all([
          supabase.from('tenant_settings').select('*').eq('tenant_id', roleData.tenant_id).single(),
          fetchProducts(),
          fetchCustomers()
        ]);
        
        if (settingsRes.data) {
           setTenantSettings(settingsRes.data);
        }
      }
    } else {
        window.location.replace('/login');
    }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data);
  };

  const fetchProducts = async () => {
    const { data: products } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });

    if (products) {
      setDbProducts(products);

      // Extract unique categories dynamically
      const uniqueCats = new Set<string>();
      products.forEach((p: any) => {
         if (p.categories?.name) uniqueCats.add(p.categories.name);
      });
      const dynamicCats = Array.from(uniqueCats).map(c => ({ id: c, label: c }));
      setCategories([{ id: "All Items", label: "All Items" }, ...dynamicCats]);
    }
  };

  const sidebarLinks = [
    { label: t('dashboard'), href: "/dashboard", icon: LayoutDashboard },
    { label: t('pos'), href: "/pos", icon: ShoppingBag, active: true },
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
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          
          if (dataUrl.length > 8000) {
            toast.error(lang === 'en' ? "Image quality too high." : "Sawirka waa uu weyn yahay wali.");
            return;
          }
          setEditPic(dataUrl);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.replace('/login');
    }
  };

  const handleSaveProfile = async () => {
    setUserName(editName);
    setUserRole(editRole);
    setProfilePic(editPic);
    
    if (typeof window !== "undefined") {
       localStorage.setItem("userName", editName);
       localStorage.setItem("userRole", editRole);
       localStorage.setItem("profilePic", editPic);
    }

    const { error } = await supabase.auth.updateUser({
      data: { 
        full_name: editName,
        role: editRole,
        // REMOVED avatar_url to fix 494 error
      }
    });

    // Clear huge metadata immediately
    await supabase.auth.updateUser({ data: { avatar_url: null } });

    if (error) {
       toast.error(lang === 'en' ? "Failed to save profile cloud-side" : "Waa la waayay kaydinta xogta profile-ka.");
    } else {
       setIsDialogOpen(false);
       toast.success(lang === 'en' ? "Profile updated! ✅" : "Xogta waa la cusboonaysiiyay! ✅");
    }
  };

  const filteredProducts = dbProducts.filter(p => {
    const categoryName = p.categories?.name || "Uncategorized";
    const matchCategory = activeCategory === "All Items" || categoryName === activeCategory;
    const matchSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const addToCart = (product: any) => {
    if (product.stock <= 0) {
       toast.error(lang === 'en' ? "Product out of stock!" : "Alaabtani waa ka dhammaatay kaydka!");
       return;
    }

    const exists = cart.find((item) => item.id === product.id);
    if (exists) {
      if (exists.qty >= product.stock) {
         toast.error(lang === 'en' ? "Max stock reached!" : "Alaab xaddi intaas la eg kuma jirto kaydka!");
         return;
      }
      toast.success(lang === 'en' ? `${product.name} +1` : `${product.name} lagu daray +1`);
      setCart((prev) => prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      toast.success(lang === 'en' ? `${product.name} added!` : `Waa lagu daray ${product.name}!`);
      setCart((prev) => [...prev, { 
        id: product.id, 
        name: product.name, 
        price: parseFloat(product.price), 
        image: product.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random&color=fff&size=400`,
        stock: product.stock,
        qty: 1 
      }]);
    }
  };

  // Barcode Scanning Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if an input is focused
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const currentTime = new Date().getTime();
      
      // If Enter key is pressed, process the barcode buffer
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
           const cleanCode = barcodeBuffer.trim().toUpperCase();
           const matchedProduct = dbProducts.find(p => 
              (p.sku && p.sku.toUpperCase() === cleanCode) || 
              (p.barcode && p.barcode.toUpperCase() === cleanCode)
           );
           if (matchedProduct) {
              addToCart(matchedProduct);
           } else {
              toast.error(lang === 'en' ? `Product not found! (${cleanCode})` : `Badeecada lama helin! (${cleanCode})`);
           }
        }
        setBarcodeBuffer("");
        return;
      }

      // Hardware scanners type very fast (usually < 30ms per char)
      // If time since last key is large, reset buffer
      if (currentTime - lastKeyTime > 50) {
         setBarcodeBuffer(e.key);
      } else {
         setBarcodeBuffer(prev => prev + e.key);
      }
      setLastKeyTime(currentTime);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeBuffer, lastKeyTime, dbProducts, lang]);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          if (newQty > item.stock) {
             toast.error(lang === 'en' ? "Max stock reached!" : "Kaydka kuma filna!");
             return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const vatRate = 0.00; // Removed VAT logic to make it cleaner locally by default, can be added in settings
  const vatAmount = subtotal * vatRate;
  const serviceFee = cart.length > 0 ? 0.00 : 0;
  const total = cart.length > 0 ? subtotal + vatAmount + serviceFee : 0;

  const handleCheckout = async (paymentMethod: string) => {
    if (cart.length === 0 || !tenantId || !cashierId) return;
    
    if (paymentMethod === 'deyn' && !selectedCustomer) {
      toast.error(lang === 'en' ? "Please select a Customer for Debt payment." : "Fadlan soo dooro Macmiilka deynta loo qorayo.");
      return;
    }
    
    setIsProcessing(true);
    toast.loading(lang === 'en' ? "Processing sale..." : `Lacagta waa la xaraynayaa (${paymentMethod})...`);

    try {
      // 1. Create Sale Record
      const { data: saleData, error: saleError } = await supabase.from('sales').insert([{
        tenant_id: tenantId,
        cashier_id: cashierId,
        customer_id: selectedCustomer && selectedCustomer.id !== 'guest' ? selectedCustomer.id : null,
        subtotal: subtotal,
        discount: 0,
        tax: vatAmount,
        total_amount: total,
        payment_method: paymentMethod === 'deyn' ? 'credit' : paymentMethod,
        status: paymentMethod === 'deyn' ? 'debt' : 'completed'
      }]).select().single();

      if (saleError) throw saleError;

      // 2. Create Sale Items & Reduce Stock
      const saleItems = cart.map(item => ({
        tenant_id: tenantId,
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.price,
        total_price: item.price * item.qty
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // 3. Deduct Stock
      for (const item of cart) {
        const newStock = item.stock - item.qty;
        await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
      }

      // 4. Update Customer Wallet if Debt
      if (paymentMethod === 'deyn' && selectedCustomer) {
        const currentBal = parseFloat(selectedCustomer.wallet_balance || "0");
        const newBal = currentBal - total; // Negative balance implies debt owed to store
        await supabase.from('customers').update({ wallet_balance: newBal }).eq('id', selectedCustomer.id);
      }

      // 5. Prepare Receipt Data BEFORE clearing state
      const receiptDetails = {
         id: saleData.id,
         customer: selectedCustomer?.name || (lang === 'en' ? 'Cash Customer' : 'Macmiil Lacag'),
         total: total,
         paymentMethod: paymentMethod === 'deyn' ? (lang === 'en' ? 'Debt' : 'Deyn') : paymentMethod.toUpperCase(),
         items: cart.map(item => ({ ...item })), // deep copy
         date: new Date().toLocaleString(),
         subtotal: subtotal
      };

      setLastSaleData(receiptDetails);
      setShowReceipt(true); // Open the receipt view immediately

      toast.dismiss();
      toast.success(lang === 'en' ? `Receipt Paid (${paymentMethod}) & Saved! 🖨️` : `Iibku si buuxda ayuu u xarooday! 🖨️✅`, { duration: 3000 });
      
      // 6. Clear transaction states
      setCart([]);
      setSelectedCustomer(null);
      setIsCheckoutModalOpen(false);
      fetchProducts(); // refresh stock
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiscard = () => {
    setCart([]);
  };

  const handleDownloadReceipt = async (type: 'pdf' | 'image') => {
     const element = document.getElementById('receipt-print-area');
     if (!element) return;
     
     toast.loading(lang === 'en' ? "Generating file..." : "Waa la diyaarinayaa...");
     
     try {
         // Force explicit dimensions for the cloned node so Safari doesn't clip overflowing edges on narrow screens
         const imgData = await toPng(element, { 
            quality: 1, 
            pixelRatio: 3, 
            backgroundColor: '#ffffff',
            style: {
               width: '380px',
               height: 'auto',
               transform: 'none',
               margin: '0',
               position: 'relative'
            }
         });
         const fileName = `receipt-${lastSaleData.id.slice(0,8)}.pdf`;

         if (type === 'image') {
            download(imgData, fileName.replace('.pdf', '.png'), 'image/png');
         } else {
            const tempImg = new window.Image();
            tempImg.src = imgData;
            await new Promise(resolve => tempImg.onload = resolve);
            
            const pdf = new jsPDF({
               orientation: 'portrait',
               unit: 'mm',
               format: [80, (tempImg.height * 80) / tempImg.width]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, 80, (tempImg.height * 80) / tempImg.width);
            pdf.save(fileName);
         }
         
         toast.dismiss();
         toast.success(lang === 'en' ? "Downloaded!" : "Waa la soo dejiyay!");
     } catch(err) {
         toast.dismiss();
         console.error(err);
         toast.error("Galdaloolo ayaa dhacday (" + (err as Error)?.message + ")");
     }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'so' : 'en');
  };

  return (
    <>
      <style>{`
        @media print {
          @page { 
            margin: 0;
            size: 80mm;
          }
          
          /* Collapse height of all layout containers to prevent extra pages */
          html, body, #__next, main, [data-radix-portal], .flex-1, .flex {
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          
          /* Hide non-print elements */
          div[role="dialog"],
          div[data-state],
          .fixed,
          aside,
          header,
          .print-hidden,
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
            padding: 12px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
          }
        }
      `}</style>
      <div className="flex h-[100dvh] bg-white text-zinc-900 overflow-hidden font-sans w-full max-w-[100vw]">
      
      {/* 1. SIDEBAR */}
      <aside className="w-[240px] bg-[#0b132b] text-zinc-400 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          <div className="p-8 pb-12 cursor-pointer hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-bold text-white tracking-wide">
              Dukaan Pro
            </h1>
            <p className="text-xs text-zinc-500 font-medium tracking-widest mt-1">POWERED BY SYSTEM</p>
          </div>
          
          <nav className="px-4 space-y-2">
            {sidebarLinks.map((link) => (
              <Link href={link.href} key={link.label}>
                <button 
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${
                    link.active 
                      ? "bg-[#182343] text-white font-medium" 
                      : "hover:bg-[#182343]/50 hover:text-white"
                  }`}
                >
                  <link.icon className="h-5 w-5 mr-4" />
                  {link.label}
                </button>
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="p-6">
          <Button 
            className="w-full bg-[#8fa4cf]/80 hover:bg-[#8fa4cf] text-[#0b132b] font-semibold py-6 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            {t('new_sale') || "New Sale"}
          </Button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 bg-[#f9f9fb] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-20 px-4 md:px-8 flex items-center justify-between bg-[#f9f9fb] shrink-0 border-b border-zinc-200 shadow-sm z-10 w-full mb-2 pb-2">
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
                     <SheetTitle className="text-xl font-bold text-white tracking-wide">Dukaan Pro</SheetTitle>
                     <p className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">POS MOBILE</p>
                  </SheetHeader>
                  <nav className="px-4 space-y-2">
                    {sidebarLinks.map((link) => (
                      <Link href={link.href} key={link.label}>
                        <button 
                          className={`w-full flex items-center px-4 py-4 rounded-xl transition-all ${
                            link.active 
                              ? "bg-[#182343] text-white font-medium" 
                              : "hover:bg-[#182343]/50 hover:text-white"
                          }`}
                        >
                          <link.icon className="h-5 w-5 mr-4" />
                          {link.label}
                        </button>
                      </Link>
                    ))}
                  </nav>
               </SheetContent>
            </Sheet>

            <div className="relative w-full max-w-[200px] sm:max-w-xs md:max-w-md shrink">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder={lang === 'en' ? "Search..." : "Raadi..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 md:pl-12 pr-4 py-2.5 md:py-3 bg-[#eef0f3] border-none rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#0b132b]/20 text-[#141b2d] placeholder-zinc-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-6 ml-2 md:ml-0">
             <button onClick={toggleLang} className="flex items-center text-[10px] md:text-xs font-bold text-zinc-500 hover:text-blue-600 transition-colors bg-[#eef0f3] px-2 md:px-3 py-1.5 rounded-full">
               <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
               <span className="hidden md:inline">{lang === 'en' ? 'EN' : 'SO'}</span>
             </button>
            <button className="text-zinc-500 hover:text-zinc-800 transition-colors hidden sm:block font-bold"><Bell className="h-5 w-5" /></button>
            {/* PROFILE EDIT (DIALOG) */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger className="flex items-center border-l border-zinc-200 pl-4 md:pl-6 space-x-2 md:space-x-3 cursor-pointer group focus:outline-none bg-transparent border-none text-left p-0">
                  <div className="text-right transition-colors group-hover:text-blue-600 hidden sm:block">
                    <p className="text-sm font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors uppercase">{userName}</p>
                    <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">{userRole === 'STORE MANAGER' && lang === 'so' ? t('store_manager') : userRole}</p>
                  </div>
                  <div className="h-8 w-8 md:h-10 md:w-10 bg-zinc-300 rounded-full overflow-hidden border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-green-100 transition-all">
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white border-zinc-200">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-[#141b2d]">{lang === 'en' ? 'Manage Account' : 'Maamuska Akoonka'}</DialogTitle>
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                      className="bg-[#f9f9fb] h-12"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-[#141b2d]">{t('role')}</label>
                    <Input 
                      value={editRole}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRole(e.target.value)}
                      className="bg-[#f9f9fb] h-12"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-[#141b2d]">{t('upload_picture')}</label>
                    <Input 
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="bg-[#f9f9fb] h-12 pt-2.5 cursor-pointer"
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleLogout} 
                    className="h-12 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    {lang === 'en' ? 'Logout' : 'Ka bax'}
                  </Button>
                  <Button onClick={handleSaveProfile} className="h-12 bg-green-600 hover:bg-green-700 rounded-xl px-8 flex-1">{t('save_changes')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Collection & Products */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pt-4 pb-20">
          <div className="mb-8 mt-2 flex justify-between items-start">
            <div>
              <h2 className="text-4xl font-bold text-[#141b2d] mb-2 tracking-tight">{lang === 'en' ? 'Cashier Layout' : 'Meesha Iibka'}</h2>
              <p className="text-zinc-500 text-lg">{lang === 'en' ? 'Select products below to add to cart.' : 'Riix alaabta si ay u gasho Khasnadda.'}</p>
            </div>
            <div className="flex gap-2">
               <Button 
                  onClick={async () => {
                     const loadToast = toast.loading(lang === 'en' ? 'Refreshing products...' : 'Waa la cusboonaysiinayaa alaabta...');
                     await fetchProducts();
                     toast.dismiss(loadToast);
                     toast.success(lang === 'en' ? 'Refreshed! ✅' : 'Waa la cusboonaysiiyay! ✅');
                  }} 
                  variant="outline" 
                  className="border-zinc-200 text-[#141b2d] bg-white h-12 rounded-xl shadow-sm hover:bg-zinc-50 font-bold"
               >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {lang === 'en' ? 'Refresh' : 'Cusboonaysii'}
               </Button>
               <Button onClick={() => setIsCameraOpen(!isCameraOpen)} variant="outline" className="border-zinc-200 text-[#141b2d] bg-white h-12 rounded-xl shadow-sm hover:bg-zinc-50 font-bold">
                  <Camera className="h-5 w-5 mr-2" />
                  {isCameraOpen ? "Close Camera" : "Scan Barkood (Kamarad)"}
               </Button>
            </div>
          </div>

          {isCameraOpen && (
             <div className="mb-8 w-full flex justify-center bg-zinc-50 p-6 rounded-3xl border-2 border-dashed border-zinc-200">
               <BarcodeScannerCamera 
                  onScan={(decodedText) => {
                     const cleanCode = decodedText.trim().toUpperCase();
                     const matchedProduct = dbProducts.find(p => 
                        (p.sku && p.sku.toUpperCase() === cleanCode) || 
                        (p.barcode && p.barcode.toUpperCase() === cleanCode)
                     );
                     if (matchedProduct) {
                        addToCart(matchedProduct);
                        toast.success(lang === 'en' ? `Added ${matchedProduct.name}` : `Waa lagu daray ${matchedProduct.name}`);
                     } else {
                        toast.error(lang === 'en' ? `Product not found! (${cleanCode})` : `Badeecada lama helin! (${cleanCode})`);
                     }
                  }} 
                  onClose={() => setIsCameraOpen(false)}
               />
             </div>
          )}

          <div className="flex flex-wrap gap-2 md:gap-3 mb-8">
            {categories.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setActiveCategory(cat.id)}
                className={`px-5 md:px-7 py-2 md:py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-300 ${
                  activeCategory === cat.id 
                    ? "bg-[#141b2d] text-white shadow-xl shadow-[#141b2d]/20 scale-[1.02]" 
                    : "bg-white text-zinc-500 hover:bg-zinc-100/50 hover:text-[#141b2d] border-2 border-transparent hover:border-zinc-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
             <div className="text-zinc-400 text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200 shadow-sm font-bold">
               {dbProducts.length === 0 ? (lang === 'en' ? "Please add products to your Inventory first!" : "Fadlan Alaab ku soo dar Kaydkaaga (Inventory) marka hore.") : "Empty"}
             </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {filteredProducts.map(p => {
                const inCart = cart.find(c => c.id === p.id);
                return (
                  <div 
                    key={p.id} 
                    onClick={() => !inCart && addToCart(p)}
                    className={`relative group flex flex-col items-start bg-white rounded-3xl overflow-hidden transition-all duration-300 text-left ring-2 ${inCart ? 'ring-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]' : 'ring-transparent border border-zinc-100 shadow-sm hover:shadow-2xl hover:shadow-[#141b2d]/5 hover:-translate-y-1 cursor-pointer'}`}
                  >
                    <div className="w-full aspect-[4/5] bg-zinc-50 relative overflow-hidden">
                      <img 
                        src={p.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff&size=400&font-size=0.33`} 
                        alt={p.name} 
                        className={`object-cover w-full h-full transition-transform duration-700 ease-out ${!inCart && 'group-hover:scale-110'}`}
                      />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      {!inCart && (
                        <div className="absolute right-3 bottom-3 h-12 w-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 text-[#141b2d] transition-all duration-300">
                          <Plus className="h-6 w-6 font-bold" />
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 md:p-5 w-full bg-white relative z-10 flex flex-col min-h-[110px]">
                      <div className="flex justify-between items-start mb-1.5 gap-2">
                         <h3 className="text-sm md:text-base font-extrabold text-[#141b2d] leading-tight line-clamp-2">{p.name}</h3>
                         <span className="text-xs font-extrabold tracking-widest text-zinc-400 uppercase shrink-0">QTY: {p.stock}</span>
                      </div>
                      <p className="text-lg md:text-xl font-black text-blue-600 mt-auto">${parseFloat(p.price).toFixed(2)}</p>
                    </div>

                    {/* IN-CART COUNTER OVERLAY */}
                    {inCart && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-[#141b2d] text-white rounded-full flex items-center shadow-2xl p-1.5 px-4 space-x-6">
                           <button onClick={(e) => { e.stopPropagation(); updateQty(p.id, -1); }} className="hover:text-blue-400 p-2 transition-colors active:scale-90">
                              {inCart.qty === 1 ? <Trash2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                           </button>
                           <span className="text-2xl font-black">{inCart.qty}</span>
                           <button onClick={(e) => { e.stopPropagation(); updateQty(p.id, 1); }} className="hover:text-blue-400 p-2 transition-colors active:scale-90">
                              <Plus className="h-5 w-5" />
                           </button>
                        </div>
                        <span className="mt-4 font-bold text-[#141b2d] text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                           Total: ${(inCart.price * inCart.qty).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* 3. RIGHT CART PANEL (Responsive) */}
      <div className={`
        fixed inset-y-0 right-0 z-40 bg-white border-l border-zinc-200 flex flex-col shrink-0 
        transition-transform duration-300 transform 
        lg:relative lg:translate-x-0 lg:w-[380px] lg:z-20 lg:shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.02)]
        ${isCartOpenMobile ? 'translate-x-0 w-[320px] sm:w-[380px] shadow-2xl' : 'translate-x-full w-0 lg:w-[380px]'}
      `}>
        
        {/* Mobile Close Button for Cart */}
        {isCartOpenMobile && (
          <button 
             onClick={() => setIsCartOpenMobile(false)}
             className="lg:hidden absolute -left-12 top-6 bg-white p-3 rounded-l-2xl shadow-xl border-l border-y border-zinc-100 text-zinc-500"
          >
             <X className="h-6 w-6" />
          </button>
        )}
        
        {/* Cart Header */}
        <div className="p-6 pb-4 border-b border-zinc-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#141b2d]">{lang === 'en' ? 'Current Order' : 'Khasnadda / Cart'}</h2>
            <span className="bg-green-100 text-green-700 border border-green-200 shadow-sm text-xs font-bold px-3 py-1.5 rounded-md cursor-pointer hover:bg-green-200 transition-colors">
               {lang === 'en' ? 'Walk-In' : 'Macmiil Toos ah'}
            </span>
          </div>
          <div className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity">
            <div 
              className="flex items-center text-zinc-700 text-sm font-medium cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => {
                 if (!selectedCustomer) {
                    const tempName = window.prompt(lang === 'en' ? "Enter walk-in name (Optional):" : "Gali magaca socotada (Ikhtiyaari):");
                    if (tempName) {
                       setSelectedCustomer({ id: 'guest', name: tempName, phone: '' });
                    } else {
                       toast.success(lang === 'en' ? "Walk-In Mode Ready. Just add items!" : "Waa diyaar! Qofka socotada ah magac uma baahna, alaabta ka iibi.");
                    }
                 }
              }}
            >
              <Users className="h-4 w-4 mr-2 text-zinc-400" />
              {selectedCustomer ? (
                <div className="flex items-center">
                  <span className="font-bold text-[#141b2d]">{selectedCustomer.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} className="ml-2 text-red-500 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                lang === 'en' ? "Guest Checkout" : "Macmiil Magac la'aan"
              )}
            </div>
            {!selectedCustomer && (
              <button 
                onClick={() => setIsCustomerModalOpen(true)}
                className="text-sm font-semibold text-blue-600 underline underline-offset-4 decoration-blue-300 hover:text-blue-800 transition-colors"
              >
                {lang === 'en' ? 'Assign Customer' : 'Ku xir Macmiil'}
              </button>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {cart.map((item) => (
            <div key={item.id} className="flex gap-4">
              <div className="h-20 w-16 bg-zinc-100 rounded-lg overflow-hidden shrink-0 relative border border-zinc-200">
                <img src={item.image} alt={item.name} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 flex flex-col justify-between py-0.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-[#141b2d] text-sm leading-tight">{item.name}</h4>
                    {item.variant ? (
                       <p className="text-xs text-zinc-500 mt-1">{item.variant}</p>
                    ) : (
                       <p className="text-xs text-zinc-500 mt-1">Qty: {item.qty} x ${item.price.toFixed(2)}</p>
                    )}
                  </div>
                  <span className="font-bold text-[#141b2d]">${(item.price * item.qty).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex items-center space-x-3 bg-[#eef0f3] rounded-md px-2 py-1 select-none">
                    <button onClick={() => updateQty(item.id, -1)} className="text-zinc-500 hover:text-[#141b2d] p-0.5 transition-colors">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-4 text-center text-[#141b2d]">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="text-zinc-500 hover:text-[#141b2d] p-0.5 transition-colors">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button onClick={() => removeCartItem(item.id)} className="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-all" title="Remove Item">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
             <div className="flex flex-col items-center justify-center text-zinc-400 font-medium py-16 opacity-60">
                <ShoppingBag className="h-16 w-16 mb-4 text-zinc-300" />
                <p>{lang === 'en' ? 'Empty Cart' : 'Khasnadu way madhan tahay'}</p>
             </div>
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-6 bg-white border-t border-zinc-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10 relative">
          <div className="space-y-4 mb-6">
            <div className="flex justify-between text-sm items-center">
               <span className="text-zinc-500 font-extrabold tracking-wider">{lang === 'en' ? 'Subtotal' : 'Wadarta'}</span>
               <span className="font-extrabold text-[#141b2d] text-base">
                  ${subtotal.toFixed(2)}
               </span>
            </div>
            {/* Divider */}
            <div className="w-full border-t border-dashed border-zinc-200"></div>
          </div>
          
          <div className="flex justify-between items-end mb-6 bg-[#f9f9fb] p-4 rounded-2xl border border-zinc-100">
            <div>
              <p className="text-[10px] font-black text-zinc-400 tracking-widest mb-1 uppercase">{lang === 'en' ? 'Total Payable' : 'Wadarta Guud'}</p>
              <h2 className="text-4xl text-[#141b2d]">
                <span className="font-bold text-xl mr-1">$</span>
                <span className="font-black tracking-tighter">{total.toFixed(2)}</span>
              </h2>
            </div>
            <div className="flex flex-col items-end">
               <span className="bg-[#141b2d] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 mb-1">
                 {cart.reduce((a, b) => a + b.qty, 0)} {lang === 'en' ? 'Items' : 'Xabo'}
               </span>
            </div>
          </div>

          <button 
             onClick={() => setIsCheckoutModalOpen(true)}
             disabled={cart.length === 0 || isProcessing}
             className={`w-full flex items-center justify-center py-4 rounded-2xl font-black text-lg mb-4 transition-all duration-300 ${cart.length > 0 && !isProcessing ? 'bg-gradient-to-r from-blue-600 to-[#141b2d] hover:from-blue-700 hover:to-black text-white shadow-xl shadow-blue-900/20 active:scale-[0.98]' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}
          >
            <Receipt className="h-6 w-6 mr-3" />
            {lang === 'en' ? "Proceed to Payment" : "Guda-Gal Lacagta"}
          </button>
          
          <div className="flex gap-4">
            <button 
               onClick={handleDiscard}
               disabled={cart.length === 0 || isProcessing}
               className="flex-1 py-3 px-4 bg-red-50 hover:bg-red-100 border-none text-red-600 font-extrabold rounded-2xl text-sm transition-all shadow-sm active:scale-[0.96] disabled:opacity-50 disabled:bg-zinc-50"
            >
               {lang === 'en' ? 'Discard' : 'Tirtir'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. CHECKOUT MODAL (For Mobile Money & Cash) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b132b]/80 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => !isProcessing && setIsCheckoutModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-800 transition-colors bg-zinc-100 p-2 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h2 className="text-3xl font-extrabold text-[#141b2d] mb-1">{lang === 'en' ? 'Payment Method' : 'Habka Lacag-Bixinta'}</h2>
            <p className="text-zinc-500 mb-6 font-medium">{lang === 'en' ? 'Select how the customer is paying.' : 'Fadlan dooro nooca uu qofku wax ku bixinayo.'}</p>
            
            <div className="flex flex-col items-center justify-center bg-zinc-50 py-6 rounded-2xl border border-zinc-100 mb-6">
               <span className="text-sm tracking-widest text-zinc-400 font-bold uppercase mb-1">{lang === 'en' ? 'AMOUNT DUE' : 'LACAGTA LA RABO'}</span>
               <span className="text-5xl font-extrabold text-[#141b2d] tracking-tighter">${total.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => handleCheckout('zaad')} disabled={isProcessing} className="py-5 rounded-2xl bg-[#00A166] hover:bg-[#008c58] font-bold text-white shadow-lg shadow-[#00A166]/20 transition-transform active:scale-95 disabled:opacity-50">
                 💸 ZAAD Service
              </button>
              <button onClick={() => handleCheckout('edahab')} disabled={isProcessing} className="py-5 rounded-2xl bg-[#FFD700] hover:bg-[#e6c200] font-bold text-[#141b2d] shadow-lg shadow-[#FFD700]/20 transition-transform active:scale-95 disabled:opacity-50">
                 🐪 eDahab
              </button>
              <button onClick={() => handleCheckout('evc_plus')} disabled={isProcessing} className="col-span-2 py-5 rounded-2xl bg-[#CC0000] hover:bg-[#b00000] font-bold text-white shadow-lg shadow-[#CC0000]/20 transition-transform active:scale-95 disabled:opacity-50">
                 📱 EVC Plus
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => handleCheckout('cash_usd')} disabled={isProcessing} className="py-4 rounded-xl bg-[#141b2d] hover:bg-[#1f2945] font-bold text-white shadow transition-transform active:scale-95 disabled:opacity-50">
                💵 Dollar ($)
              </button>
              <button onClick={() => handleCheckout('cash_slsh')} disabled={isProcessing} className="py-4 rounded-xl border-2 border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-[#141b2d] shadow-sm transition-transform active:scale-95 disabled:opacity-50">
                💴 Shillin (SLSH)
              </button>
            </div>

            <button 
               onClick={() => handleCheckout('deyn')} 
               disabled={isProcessing || !selectedCustomer} 
               className={`w-full py-4 rounded-xl font-bold transition-all shadow-sm ${selectedCustomer ? 'bg-[#ffeedd] text-[#cc5500] hover:bg-[#ffddbb] shadow-[#cc5500]/10' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}
            >
               📓 {lang === 'en' ? 'Pay Later (Debt)' : 'Deyn (Pay Later)'}
               {!selectedCustomer && <span className="block text-xs font-medium mt-0.5 opacity-70">(Dooro Macmiil marka hore)</span>}
            </button>
            
            {isProcessing && (
               <div className="mt-6 flex justify-center items-center h-10 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold animate-pulse">
                  Processing Payment...
               </div>
            )}
          </div>
        </div>
      )}

      {/* 5. CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b132b]/80 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsCustomerModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-800 transition-colors bg-zinc-100 p-2 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h2 className="text-2xl font-extrabold text-[#141b2d] mb-1">{lang === 'en' ? 'Select Customer' : 'Dooro Macmiil'}</h2>
            <p className="text-zinc-500 mb-6 font-medium text-sm">{lang === 'en' ? 'Assign this sale to a specific customer.' : 'Ku xidh iibkan macmiil gaar ah.'}</p>
            
            <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
              {customers.map(c => (
                <button 
                  key={c.id} 
                  onClick={() => { setSelectedCustomer(c); setIsCustomerModalOpen(false); }}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-bold text-[#141b2d]">{c.name}</span>
                  <span className="text-xs text-zinc-400">{c.phone || "No phone"}</span>
                </button>
              ))}
              {customers.length === 0 && (
                <p className="text-center text-zinc-500 py-8 text-sm">No customers found.</p>
              )}
            </div>
          </div>
        </div>
      )}

       {/* 6. RECEIPT MODAL (Authentic Somaliland Style) */}
       {showReceipt && lastSaleData && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white text-[#141b2d] w-full max-w-[340px] shadow-2xl relative overflow-hidden font-mono text-[12px] border border-zinc-200 m-auto mx-auto my-12 flex flex-col max-h-[90vh]">
               {/* Success Banner (UI only) */}
               <div className="bg-green-600 text-white text-center py-2 text-[10px] font-bold uppercase tracking-widest shrink-0 relative flex justify-center items-center">
                  <span>{lang === 'en' ? 'Transaction Success' : 'Iibku waa xarooday'}</span>
                  <button 
                     onClick={() => setShowReceipt(false)} 
                     className="absolute right-2 text-white hover:text-red-200 font-extrabold text-[10px] p-1 px-2.5 bg-black/25 rounded transition-colors"
                  >
                     ✕ {lang === 'en' ? 'Close' : 'Xidh'}
                  </button>
               </div>

                <div id="receipt-print-area" className="p-5 overflow-y-auto custom-scrollbar bg-white print-target">
                  {/* Thermal Header */}
                  <div className="text-center space-y-0.5 mb-4">
                     <p className="font-bold text-[10px] uppercase">Sales Receipt #{lastSaleData.id.slice(0, 8).toUpperCase()}</p>
                     <div className="flex justify-between text-[10px] border-b border-zinc-100 pb-1 mb-1 font-bold">
                        <span>{lastSaleData.date.split(',')[0]}</span>
                        <span>{lastSaleData.date.split(',')[1]}</span>
                     </div>
                     <h2 className="text-lg font-black uppercase leading-tight mt-1">{storeName || "MY STORE"}</h2>
                     {tenantSettings?.receipt_header ? (
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
                     {lastSaleData.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start leading-tight">
                           <span className="w-1/2 text-left font-bold uppercase text-[10px]">{item.name}</span>
                           <span className="w-1/6 text-center">{item.qty}</span>
                           <span className="w-1/6 text-right">${item.price.toFixed(2)}</span>
                           <span className="w-1/6 text-right font-bold">${(item.price * item.qty).toFixed(2)}</span>
                        </div>
                     ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-0.5 border-b border-black pb-2 mb-2">
                     <div className="flex justify-between">
                        <span className="font-bold">Subtotal:</span>
                        <span>${lastSaleData.subtotal.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between text-[10px]">
                        <span>Local Sales Tax (0%):</span>
                        <span>+ $0.00</span>
                     </div>
                     <div className="flex justify-between font-black text-[14px] mt-1 pt-1 border-t border-zinc-100">
                        <span>RECEIPT TOTAL:</span>
                        <span>${lastSaleData.total.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between font-bold text-[11px] text-zinc-500">
                        <span>TOTAL (SLSH):</span>
                        <span>{ (lastSaleData.total * (tenantSettings?.exchange_rate || 8500)).toLocaleString() } SH</span>
                     </div>
                  </div>

                  {/* Payment */}
                  <div className="mb-4">
                     <p className="font-black text-[13px] uppercase">{lastSaleData.paymentMethod}: ${lastSaleData.total.toFixed(2)}</p>
                  </div>

                  {/* Footer Message */}
                  <div className="text-center space-y-1">
                      {(() => {
                         if (!tenantSettings?.receipt_footer) {
                            return <p className="italic text-[10px] font-bold">Hubso Alaabtaada intaanad bixin</p>;
                         }
                         try {
                            const parsedFooter = JSON.parse(tenantSettings.receipt_footer);
                            const hasPayments = parsedFooter.zaad || parsedFooter.edahab;
                            const hasPhones = parsedFooter.phone1 || parsedFooter.phone2 || parsedFooter.phone3;
                            
                            return (
                               <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-zinc-300 text-center w-full">
                                  {parsedFooter.email && (
                                     <p className="text-[9px] font-semibold text-zinc-600">Email: {parsedFooter.email}</p>
                                  )}
                                  
                                  {hasPayments && (
                                     <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 space-y-0.5 text-[9px] font-bold text-left">
                                        <div className="text-center text-[8px] font-black uppercase text-zinc-400 border-b border-zinc-200/60 pb-0.5 mb-1">
                                           {lang === 'en' ? 'Mobile Payment Accounts' : 'Xisaabaadka Lacagaha'}
                                        </div>
                                        {parsedFooter.zaad && (
                                           <div className="flex justify-between">
                                              <span className="text-emerald-700 font-extrabold">ZAAD:</span>
                                              <span className="font-mono text-zinc-800">{parsedFooter.zaad}</span>
                                           </div>
                                        )}
                                        {parsedFooter.edahab && (
                                           <div className="flex justify-between">
                                              <span className="text-amber-700 font-extrabold">eDahab:</span>
                                              <span className="font-mono text-zinc-800">{parsedFooter.edahab}</span>
                                           </div>
                                        )}
                                     </div>
                                  )}
                                  
                                  {hasPhones && (
                                     <div className="space-y-0.5 text-[9px] text-zinc-600 font-semibold">
                                        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-wider">
                                           {lang === 'en' ? 'Contact Us / La Xidhiidh' : 'Wixii Su\'aal Ah La Xidhiidh'}
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 font-mono font-bold text-zinc-800">
                                           {parsedFooter.phone1 && <span>{parsedFooter.phone1}</span>}
                                           {parsedFooter.phone2 && <span>• {parsedFooter.phone2}</span>}
                                           {parsedFooter.phone3 && <span>• {parsedFooter.phone3}</span>}
                                        </div>
                                     </div>
                                  )}
                               </div>
                            );
                         } catch (e) {
                            return <p className="italic text-[10px] font-bold whitespace-pre-wrap">{tenantSettings.receipt_footer}</p>;
                         }
                      })()}
                     
                     {/* Dynamic Barcode Placeholder */}
                     <div className="flex flex-col items-center pt-2">
                        <div className="w-full h-10 bg-zinc-100 border-x-2 border-black flex items-center justify-center relative">
                           <div className="absolute inset-x-0 top-0 bottom-0 flex justify-between px-1 opacity-20">
                              {[...Array(20)].map((_, i) => (
                                 <div key={i} className={`w-[1px] bg-black h-full ${i % 3 === 0 ? 'w-[2px]' : ''}`}></div>
                              ))}
                           </div>
                           <span className="bg-white/80 px-2 text-[10px] font-black z-10">{lastSaleData.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                     </div>
                  </div>
                </div>

                {/* UI Buttons */}
                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-2 shrink-0">
                   <Button onClick={() => window.print()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg h-11 shadow-sm text-sm">
                      🖨️ {lang === 'en' ? 'Print Receipt' : 'Daabac Rasiidhka'}
                   </Button>
                   <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => handleDownloadReceipt('image')} className="bg-[#141b2d] hover:bg-black text-white font-bold rounded-lg h-10 shadow-sm text-xs">
                         ⬇️ {lang === 'en' ? 'Save Image' : 'Soo deji (Sawir)'}
                      </Button>
                      <Button onClick={() => handleDownloadReceipt('pdf')} className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg h-10 shadow-sm text-xs">
                         📄 {lang === 'en' ? 'Save PDF' : 'Soo deji (PDF)'}
                      </Button>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => setShowReceipt(false)} className="border-zinc-200 text-zinc-600 font-bold rounded-lg h-10 text-xs w-full">
                         ⬅️ {lang === 'en' ? 'Back to POS' : 'Ku noqo Iibka'}
                      </Button>
                      <Link href="/dashboard" className="w-full">
                         <Button className="w-full bg-[#0b132b] hover:bg-black text-white font-bold rounded-lg h-10 text-xs">
                            📊 {lang === 'en' ? 'Dashboard' : 'Tag Dashboard'}
                         </Button>
                      </Link>
                   </div>
                </div>
            </div>
         </div>
       )}

       {/* 7. FLOATING MOBILE CART BUTTON */}
      <div className="lg:hidden fixed bottom-6 right-6 z-30">
        <Button 
          onClick={() => setIsCartOpenMobile(true)}
          className="h-16 w-16 rounded-full bg-[#0b132b] text-white shadow-2xl flex flex-col items-center justify-center relative animate-bounce hover:animate-none"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-6 w-6 rounded-full flex items-center justify-center border-2 border-white">
            {cart.reduce((acc, i) => acc + i.qty, 0)}
          </span>
        </Button>
      </div>
    </div>
    </>
  );
}
