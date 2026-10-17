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
import useBarcodeScanner from "@/hooks/useBarcodeScanner";
import { barcodeService } from "@/lib/barcode/barcode-service";
import { playErrorBeep } from "@/lib/barcode/scanner-audio";
import { generateDailyOrderId } from "@/lib/order-utils";
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
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  
  // Checkout State
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);

  type CartItem = { id: string, name: string, price: number, image: string, qty: number, stock: number, variant?: string };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateCategoriesState = (products: any[]) => {
    const uniqueCats = new Set<string>();
    products.forEach((p: any) => {
       if (p.categories?.name) uniqueCats.add(p.categories.name);
    });
    const dynamicCats = Array.from(uniqueCats).map(c => ({ id: c, label: c }));
    setCategories([{ id: "All Items", label: "All Items" }, ...dynamicCats]);
  };

  useEffect(() => {
    // 1. Instant load from local cache for 0ms delay!
    try {
      const cached = localStorage.getItem("pos_products_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDbProducts(parsed);
          barcodeService.rebuildCache(parsed);
          updateCategoriesState(parsed);
          setIsLoadingProducts(false);
        }
      }
    } catch (e) {
      console.error(e);
    }

    // 2. Start product & session fetches immediately in parallel
    fetchProducts();
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
        
        // Fetch Settings & Customers concurrently
        const [settingsRes] = await Promise.all([
          supabase.from('tenant_settings').select('*').eq('tenant_id', roleData.tenant_id).single(),
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
    // Only show skeleton if we don't already have products loaded
    setDbProducts(prev => {
      if (prev.length === 0) setIsLoadingProducts(true);
      return prev;
    });

    try {
      const { data: products } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

      if (products) {
        setDbProducts(products);
        barcodeService.rebuildCache(products);
        updateCategoriesState(products);
        try {
          localStorage.setItem("pos_products_cache", JSON.stringify(products));
        } catch (e) {
          // ignore quota error
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProducts(false);
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

  const getStoreLogo = () => {
    if (typeof window !== "undefined") {
      const savedStoreLogo = localStorage.getItem("storeLogo");
      if (savedStoreLogo && savedStoreLogo !== "/images/store-logo.png") return savedStoreLogo;
      const savedProfilePic = localStorage.getItem("profilePic");
      if (savedProfilePic && !savedProfilePic.includes("ui-avatars.com")) return savedProfilePic;
    }
    if (profilePic && !profilePic.includes("ui-avatars.com")) {
      return profilePic;
    }
    if (tenantSettings?.receipt_footer) {
      try {
        const parsed = JSON.parse(tenantSettings.receipt_footer);
        if (parsed.logo) return parsed.logo;
      } catch (e) {}
    }
    return "/images/store-logo.png";
  };

  const handleSaveProfile = async () => {
    setUserName(editName);
    setUserRole(editRole);
    setProfilePic(editPic);
    
    if (typeof window !== "undefined") {
       localStorage.setItem("userName", editName);
       localStorage.setItem("userRole", editRole);
       localStorage.setItem("profilePic", editPic);
       if (editPic && !editPic.includes("ui-avatars.com")) {
         localStorage.setItem("storeLogo", editPic);
       }
    }

    if (tenantId && editPic && !editPic.includes("ui-avatars.com")) {
      try {
        const { data: currentSettings } = await supabase
          .from('tenant_settings')
          .select('receipt_footer')
          .eq('tenant_id', tenantId)
          .single();
        let footerObj: any = {};
        if (currentSettings?.receipt_footer) {
          try { footerObj = JSON.parse(currentSettings.receipt_footer); } catch (e) {}
        }
        footerObj.logo = editPic;
        await supabase
          .from('tenant_settings')
          .update({ receipt_footer: JSON.stringify(footerObj) })
          .eq('tenant_id', tenantId);
        setTenantSettings((prev: any) => ({
          ...prev,
          receipt_footer: JSON.stringify(footerObj)
        }));
      } catch (e) {
        console.error("Failed to sync store logo", e);
      }
    }

    const { error } = await supabase.auth.updateUser({
      data: { 
        full_name: editName,
        role: editRole,
      }
    });

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

    setCart((prevCart) => {
      const exists = prevCart.find((item) => item.id === product.id);
      if (exists) {
        if (exists.qty >= product.stock) {
           setTimeout(() => {
             toast.error(lang === 'en' ? "Max stock reached!" : "Alaab xaddi intaas la eg kuma jirto kaydka!");
           }, 0);
           return prevCart;
        }
        setTimeout(() => {
          toast.success(lang === 'en' ? `${product.name} +1` : `${product.name} lagu daray +1`);
        }, 0);
        return prevCart.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      } else {
        setTimeout(() => {
          toast.success(lang === 'en' ? `${product.name} added!` : `Waa lagu daray ${product.name}!`);
        }, 0);
        return [...prevCart, { 
          id: product.id, 
          name: product.name, 
          price: parseFloat(product.price), 
          image: product.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=random&color=fff&size=400`,
          stock: product.stock,
          qty: 1 
        }];
      }
    });
  };

  // Barcode Engine Hook Integration
  const { inputRef } = useBarcodeScanner({
    isEnabled: true,
    onScan: (barcode) => {
      barcodeService.enqueueScan(
        barcode,
        (product) => {
          addToCart(product);
        },
        (notFoundCode) => {
          playErrorBeep();
          toast.error(lang === 'en' ? `Product not found! (${notFoundCode})` : `Badeecada lama helin! (${notFoundCode})`);
        },
        (error, failedCode) => {
          playErrorBeep();
          toast.error(lang === 'en' ? `Lookup error! (${failedCode})` : `Khalad baaritaan! (${failedCode})`);
        }
      );
    }
  });

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
      // 1. Prepare items payload
      const itemsPayload = cart.map(item => ({
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.price,
        total_price: item.price * item.qty
      }));

      // 2. Call the Atomic RPC to process the entire transaction safely
      const { data: newSaleId, error: rpcError } = await supabase.rpc('process_pos_checkout', {
        p_tenant_id: tenantId,
        p_cashier_id: cashierId,
        p_customer_id: selectedCustomer && selectedCustomer.id !== 'guest' ? selectedCustomer.id : null,
        p_subtotal: subtotal,
        p_tax: vatAmount,
        p_discount: 0,
        p_total_amount: total,
        p_payment_method: paymentMethod === 'deyn' ? 'credit' : paymentMethod,
        p_status: paymentMethod === 'deyn' ? 'debt' : 'completed',
        p_items: itemsPayload
      });

      if (rpcError) {
         // Friendly error mapping for stock issues raised by the database
         if (rpcError.message.includes("Insufficient stock")) {
            throw new Error(lang === 'en' ? "Insufficient stock for one or more items!" : "Kaydka alaabta qaar kuma filna!");
         }
         throw new Error(rpcError.message || "Failed to process checkout securely.");
      }
      
      const saleData = { id: newSaleId };

      // Calculate sequential daily order index (e.g. 01-2026-10-18)
      let orderIndexToday = 1;
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfToday.toISOString());
        if (count && count > 0) {
          orderIndexToday = count;
        }
      } catch (err) {
        console.warn("Could not calculate order index:", err);
      }

      const formattedOrderId = generateDailyOrderId(new Date(), orderIndexToday);

      // Save order_number to sales table
      try {
        await supabase
          .from('sales')
          .update({ order_number: formattedOrderId })
          .eq('id', newSaleId);
      } catch (e) {}

      // 5. Prepare Receipt Data BEFORE clearing state
      const receiptDetails = {
         id: saleData.id,
         orderId: formattedOrderId,
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
         const fileName = `receipt-${lastSaleData.orderId || lastSaleData.id.slice(0,8)}.pdf`;

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
          html, body, #__next, main, [data-radix-portal], .flex-1 {
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
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 rounded-xl transition-all text-zinc-400 hover:text-red-400 hover:bg-red-500/10 font-medium"
            >
              <LogOut className="h-5 w-5 mr-4 text-zinc-400" />
              {lang === 'en' ? 'Logout' : 'Ka bax'}
            </button>
          </nav>
        </div>
        
        <div className="p-6 space-y-3">
          <Button 
            onClick={() => {
              setCart([]);
              setSelectedCustomer(null);
            }}
            className="w-full bg-[#8fa4cf]/80 hover:bg-[#8fa4cf] text-[#0b132b] font-semibold py-6 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            {t('new_sale') || "New Sale"}
          </Button>

        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 bg-[#f9f9fb] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 md:h-20 px-3 md:px-8 flex items-center justify-between bg-white shrink-0 border-b border-zinc-200 shadow-xs z-10 w-full max-w-[100vw] overflow-hidden">
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
               <SheetContent side="left" className="bg-[#0b132b] border-none text-zinc-400 p-0 w-[240px] flex flex-col justify-between">
                  <div>
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
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center px-4 py-4 rounded-xl transition-all text-zinc-400 hover:text-red-400 hover:bg-red-500/10 font-medium"
                      >
                        <LogOut className="h-5 w-5 mr-4 text-zinc-400" />
                        {lang === 'en' ? 'Logout' : 'Ka bax'}
                      </button>
                    </nav>
                  </div>

               </SheetContent>
            </Sheet>

            <div className="relative w-full max-w-[160px] xs:max-w-[200px] sm:max-w-xs md:max-w-md shrink">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-zinc-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder={lang === 'en' ? "Search..." : "Raadi..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-11 md:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 bg-[#eef0f3] border-none rounded-xl text-xs sm:text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[#0b132b]/20 text-[#141b2d] placeholder-zinc-500"
              />
              {/* Hidden input field for hardware barcode scanner */}
              <input 
                 ref={inputRef}
                 type="text" 
                 className="absolute opacity-0 pointer-events-none h-0 w-0" 
                 tabIndex={-1}
                 aria-hidden="true"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3 ml-2 md:ml-0">
             <button onClick={toggleLang} className="flex items-center text-[10px] md:text-xs font-bold text-zinc-500 hover:text-blue-600 transition-colors bg-[#eef0f3] px-2 md:px-3 py-1.5 rounded-full">
               <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
               <span className="hidden md:inline">{lang === 'en' ? 'EN' : 'SO'}</span>
             </button>
            <button className="text-zinc-500 hover:text-zinc-800 transition-colors hidden sm:block font-bold"><Bell className="h-5 w-5" /></button>
            


            {/* PROFILE EDIT (DIALOG) */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger className="flex items-center border-l border-zinc-200 pl-3 md:pl-4 space-x-2 md:space-x-3 cursor-pointer group focus:outline-none bg-transparent border-none text-left p-0">
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
                  <Button onClick={handleSaveProfile} className="h-12 bg-green-600 hover:bg-green-700 rounded-xl px-8 w-full">{t('save_changes')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Collection & Products */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 md:p-8 pt-2 sm:pt-4 pb-24 max-w-[100vw] overflow-x-hidden">
          {/* Cashier Page Header (Logical, Responsive, Aesthetic) */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-[#141b2d] tracking-tight leading-tight">
                {lang === 'en' ? 'Cashier Layout' : 'Meesha Iibka'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">
                {lang === 'en' ? 'Select products below to add to cart.' : 'Riix alaabta si aad ugu darto khasnadda.'}
              </p>
            </div>
            
            {/* Quick Actions (Full-width 2-column grid on mobile, neat inline buttons on tablet/desktop) */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
               <Button 
                  onClick={() => {
                     window.location.reload();
                  }} 
                  variant="outline" 
                  className="w-full sm:w-auto border-zinc-200 text-[#141b2d] bg-white h-10 sm:h-11 px-3 sm:px-4 rounded-xl shadow-xs hover:bg-zinc-50 font-bold text-xs sm:text-sm flex items-center justify-center transition-all active:scale-95"
               >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-zinc-500 shrink-0" />
                  <span>{lang === 'en' ? 'Refresh' : 'Cusboonaysii'}</span>
               </Button>
               <Button 
                  onClick={() => setIsCameraOpen(!isCameraOpen)} 
                  variant="outline" 
                  className={`w-full sm:w-auto border-zinc-200 bg-white h-10 sm:h-11 px-3 sm:px-4 rounded-xl shadow-xs font-bold text-xs sm:text-sm flex items-center justify-center transition-all active:scale-95 ${
                    isCameraOpen ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'text-[#141b2d] hover:bg-zinc-50'
                  }`}
               >
                  <Camera className={`h-4 w-4 mr-1.5 shrink-0 ${isCameraOpen ? 'text-red-500' : 'text-blue-600'}`} />
                  <span className="truncate">{isCameraOpen ? (lang === 'en' ? 'Close Camera' : 'Xidh Kamarada') : (lang === 'en' ? 'Scan Barcode' : 'Scan Barkood')}</span>
               </Button>
            </div>
          </div>

          {isCameraOpen && (
             <div className="mb-8 w-full flex justify-center bg-zinc-50 p-6 rounded-3xl border-2 border-dashed border-zinc-200">
               <BarcodeScannerCamera 
                  onScan={(decodedText) => {
                     barcodeService.enqueueScan(
                        decodedText,
                        (product) => {
                           addToCart(product);
                        },
                        (notFoundBarcode) => {
                           playErrorBeep();
                           toast.error(lang === 'en' ? `Product not found! (${notFoundBarcode})` : `Badeecada lama helin! (${notFoundBarcode})`);
                        },
                        (error, failedBarcode) => {
                           playErrorBeep();
                           toast.error(lang === 'en' ? `Lookup error! (${failedBarcode})` : `Khalad baaritaan! (${failedBarcode})`);
                        }
                     );
                  }} 
                  onClose={() => setIsCameraOpen(false)}
               />
             </div>
          )}

          {/* Categories (Smooth horizontal scroll on phone, wrap on desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 mb-4 sm:mb-6 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
            {categories.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 shrink-0 ${
                  activeCategory === cat.id 
                    ? "bg-[#141b2d] text-white shadow-md shadow-[#141b2d]/20 scale-[1.02]" 
                    : "bg-white text-zinc-600 hover:bg-zinc-100 hover:text-[#141b2d] border border-zinc-200/70 shadow-xs"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {isLoadingProducts ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-3xl p-4 border border-zinc-100 shadow-sm animate-pulse flex flex-col space-y-4">
                  <div className="w-full aspect-[4/5] bg-zinc-200/60 rounded-2xl"></div>
                  <div className="h-4 bg-zinc-200/60 rounded w-3/4"></div>
                  <div className="h-5 bg-zinc-200/60 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
             <div className="text-zinc-400 text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200 shadow-sm font-bold">
               {dbProducts.length === 0 ? (lang === 'en' ? "Please add products to your Inventory first!" : "Fadlan Alaab ku soo dar Kaydkaaga (Inventory) marka hore.") : (lang === 'en' ? "No products match search." : "Lama helin alaab waafaqsan raadintaada.")}
             </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {filteredProducts.map(p => {
                const inCart = cart.find(c => c.id === p.id);
                return (
                  <div 
                    key={p.id} 
                    onClick={() => !inCart && addToCart(p)}
                    className={`relative group flex flex-col items-start bg-white rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 text-left ring-2 ${inCart ? 'ring-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]' : 'ring-transparent border border-zinc-100 shadow-sm hover:shadow-2xl hover:shadow-[#141b2d]/5 hover:-translate-y-1 cursor-pointer'}`}
                  >
                    <div className="w-full aspect-[4/5] bg-zinc-50 relative overflow-hidden">
                      <img 
                        src={p.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff&size=400&font-size=0.33`} 
                        alt={p.name} 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&color=fff&size=400&font-size=0.33`;
                        }}
                        className={`object-cover w-full h-full transition-transform duration-700 ease-out ${!inCart && 'group-hover:scale-110'}`}
                      />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      {!inCart && (
                        <div className="absolute right-3 bottom-3 h-12 w-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 text-[#141b2d] transition-all duration-300">
                          <Plus className="h-6 w-6 font-bold" />
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 sm:p-4 md:p-5 w-full bg-white relative z-10 flex flex-col min-h-[90px] sm:min-h-[110px]">
                      <div className="flex justify-between items-start mb-1.5 gap-2">
                         <h3 className="text-sm md:text-base font-extrabold text-[#141b2d] leading-tight line-clamp-2">{p.name}</h3>
                         <span className="text-xs font-extrabold tracking-widest text-zinc-400 uppercase shrink-0">QTY: {p.stock}</span>
                      </div>
                      <p className="text-lg md:text-xl font-black text-blue-600 mt-auto">${parseFloat(p.price).toFixed(2)}</p>
                    </div>

                    {/* IN-CART COUNTER OVERLAY */}
                    {inCart && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-2 text-center animate-in fade-in duration-200">
                        <div className="bg-[#141b2d] text-white rounded-full flex items-center shadow-2xl p-1 sm:p-1.5 px-2 sm:px-4 space-x-2 sm:space-x-4">
                           <button onClick={(e) => { e.stopPropagation(); updateQty(p.id, -1); }} className="hover:text-blue-400 p-1 sm:p-1.5 transition-colors active:scale-90">
                              {inCart.qty === 1 ? <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Minus className="h-4 w-4 sm:h-5 sm:w-5" />}
                           </button>
                           <span className="text-lg sm:text-2xl font-black">{inCart.qty}</span>
                           <button onClick={(e) => { e.stopPropagation(); updateQty(p.id, 1); }} className="hover:text-blue-400 p-1 sm:p-1.5 transition-colors active:scale-90">
                              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                           </button>
                        </div>
                        <span className="mt-2 sm:mt-4 font-bold text-[#141b2d] text-xs sm:text-sm bg-white px-2 sm:px-3 py-1 rounded-full shadow-sm">
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
            <div key={item.id} className="flex gap-4 relative overflow-hidden rounded-2xl p-2 -m-2">
              <div key={item.qty} className="absolute inset-0 pointer-events-none rounded-2xl animate-flash-green" />
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

       {/* 6. RECEIPT MODAL (Authentic POS Style with Store Logo) */}
       {showReceipt && lastSaleData && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white text-[#141b2d] w-full max-w-[360px] shadow-2xl relative overflow-hidden font-mono text-[12px] border border-zinc-200 m-auto mx-auto my-8 flex flex-col max-h-[92vh] rounded-2xl">
                
                {/* Circular Close Button (top-right like sample) */}
                <button 
                  onClick={() => setShowReceipt(false)} 
                  className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition-colors shadow-sm cursor-pointer"
                  title={lang === 'en' ? 'Close' : 'Xidh'}
                >
                  <X className="w-4 h-4" />
                </button>

                <div id="receipt-print-area" className="p-5 overflow-y-auto custom-scrollbar bg-white print-target flex-1">
                  {/* Top Circular Store Logo */}
                  <div className="flex justify-center mb-2.5">
                    <div className="w-16 h-16 rounded-full border border-zinc-200 overflow-hidden shadow-sm flex items-center justify-center p-1 bg-white">
                      <img 
                        src={getStoreLogo()} 
                        alt="Store Logo" 
                        className="w-full h-full object-contain rounded-full" 
                      />
                    </div>
                  </div>

                  {/* Store Name & Header Info */}
                  <div className="text-center space-y-0.5 mb-2">
                    <h2 className="text-base font-black uppercase tracking-wider text-[#141b2d] leading-tight">
                      {storeName || "DUKAAN PRO"}
                    </h2>
                    <p className="text-[11px] text-zinc-600 font-medium leading-tight">
                      {tenantSettings?.receipt_header || (lang === 'en' ? 'Quality Products & Services' : 'Tayada & Adeeg Hufan')}
                    </p>
                    {/* Contact details: Tel on top, ZAAD/E-Dahab underneath */}
                    {(() => {
                      if (!tenantSettings?.receipt_footer) return null;
                      try {
                        const parsedFooter = JSON.parse(tenantSettings.receipt_footer);
                        const hasPhones = parsedFooter.phone1 || parsedFooter.phone2 || parsedFooter.phone3;
                        const hasPayments = parsedFooter.zaad || parsedFooter.edahab;
                        if (!hasPhones && !hasPayments) return null;
                        return (
                          <div className="text-[9.5px] font-bold font-mono space-y-0.5 pt-1 text-zinc-800">
                            {hasPhones && (
                              <p>Tel: {[parsedFooter.phone1, parsedFooter.phone2, parsedFooter.phone3].filter(Boolean).join(" | ")}</p>
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

                  {/* Solid Divider */}
                  <div className="border-b border-black my-2"></div>

                  {/* Date, Order ID & Cashier */}
                  <div className="space-y-0.5 text-[10px] font-mono font-bold leading-tight">
                    <div className="flex justify-between items-center">
                      <span>Date: {lastSaleData.date}</span>
                      <span>Order ID: #{lastSaleData.orderId || lastSaleData.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="text-left">
                      <span>Cashier: {userName || "Cashier"}</span>
                    </div>
                  </div>

                  {/* Solid Divider */}
                  <div className="border-b border-black my-2"></div>

                  {/* Table Header */}
                  <div className="flex justify-between border-b border-black pb-1 mb-2 font-black text-[11px] uppercase">
                    <span className="w-1/2 text-left">MAGACA SHAYGA</span>
                    <span className="w-1/6 text-center">QTY</span>
                    <span className="w-1/6 text-right">PRICE</span>
                    <span className="w-1/6 text-right">AMOUNT</span>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5 mb-3">
                    {lastSaleData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-[10.5px] leading-tight">
                        <span className="w-1/2 text-left font-bold uppercase">{item.name}</span>
                        <span className="w-1/6 text-center">{item.qty}</span>
                        <span className="w-1/6 text-right">${item.price.toFixed(2)}</span>
                        <span className="w-1/6 text-right font-black">${(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 border-t border-zinc-200 pt-2 mb-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold">Subtotal:</span>
                      <span className="font-medium">${lastSaleData.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10.5px]">
                      <span>Local Sales Tax ({tenantSettings?.tax_rate || 0}%):</span>
                      <span>+ ${(lastSaleData.subtotal * ((tenantSettings?.tax_rate || 0) / 100)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-black pt-1 border-t border-dashed border-zinc-300">
                      <span>RECEIPT TOTAL:</span>
                      <span>${lastSaleData.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-zinc-600">
                      <span>TOTAL (SLSH):</span>
                      <span>{(Math.round(lastSaleData.total * (tenantSettings?.exchange_rate || 8500))).toLocaleString()} SH</span>
                    </div>
                  </div>

                  {/* Solid Divider */}
                  <div className="border-b border-black my-2"></div>

                  {/* Payment Status */}
                  <div className="mb-2 text-left font-black text-[12px] uppercase">
                    {lastSaleData.paymentMethod?.toLowerCase().includes('deyn') || lastSaleData.paymentMethod?.toLowerCase().includes('debt') ? (
                      <span className="text-red-600 font-black">UNPAID: ${lastSaleData.total.toFixed(2)}</span>
                    ) : (
                      <span>PAID ({lastSaleData.paymentMethod}): ${lastSaleData.total.toFixed(2)}</span>
                    )}
                  </div>



                  {/* Notice */}
                  <p className="italic font-bold text-[10.5px] uppercase tracking-wider text-center my-3">
                    HUBSO ALAABTAADA INTAANAD LABIXIN
                  </p>

                  {/* Barcode with Order ID */}
                  <div className="flex flex-col items-center pt-1 pb-1">
                    <div className="w-full h-11 bg-white border-x-2 border-black flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 bottom-0 flex justify-between px-2 opacity-75">
                        {[...Array(42)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`bg-black h-full ${i % 7 === 0 ? 'w-[3px]' : i % 3 === 0 ? 'w-[2px]' : 'w-[1px]'}`}
                          />
                        ))}
                      </div>
                      <span className="bg-white px-2 py-0.5 text-[10px] font-black z-10 border border-zinc-200 rounded">
                        {lastSaleData.orderId || lastSaleData.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* UI Action Buttons */}
                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-2 shrink-0">
                   <Button 
                     onClick={() => window.print()} 
                     className="w-full bg-[#009b5a] hover:bg-[#00854d] text-white font-bold rounded-xl h-12 shadow-sm text-sm active:scale-98 transition-all"
                   >
                      🖨️ {lang === 'en' ? 'Print Receipt' : 'Daabac Rasiidhka'}
                   </Button>
                   <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => handleDownloadReceipt('image')} 
                        className="bg-[#141b2d] hover:bg-black text-white font-bold rounded-xl h-11 shadow-sm text-xs active:scale-98 transition-all"
                      >
                         ⬇️ {lang === 'en' ? 'Download (Image)' : 'Soo deji (Sawir)'}
                      </Button>
                      <Button 
                        onClick={() => handleDownloadReceipt('pdf')} 
                        className="border border-blue-200 bg-[#edf5ff] text-[#2563eb] hover:bg-blue-100 font-bold rounded-xl h-11 shadow-sm text-xs active:scale-98 transition-all"
                      >
                         📄 {lang === 'en' ? 'Download (PDF)' : 'Soo deji (PDF)'}
                      </Button>
                   </div>
                   <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowReceipt(false)} 
                        className="border-zinc-200 text-zinc-600 font-bold rounded-xl h-10 text-xs w-full hover:bg-zinc-100"
                      >
                         ⬅️ {lang === 'en' ? 'Back to POS' : 'Ku noqo Iibka'}
                      </Button>
                      <Link href="/dashboard" className="w-full">
                         <Button className="w-full bg-[#0b132b] hover:bg-[#182343] text-white font-bold rounded-xl h-10 text-xs">
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
