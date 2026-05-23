'use client';

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Pencil, Trash2, Camera, Search, Image as ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import BarcodeScannerCamera from "@/components/BarcodeScannerCamera";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type Product = { id: string; sku: string; name: string; stock: number; price: string; status: string };

export default function InventoryPage() {
  const { t, lang } = useLanguage();
  const supabase = createClient();

  const [inventory, setInventory] = useState<Product[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugError, setDebugError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // Barcode Scanner State for Dialogs
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);
  
  // Control Forms
  const [formData, setFormData] = useState({ id: '', sku: '', name: '', price: '', stock: '', image_url: '' });
  const [searchQuery, setSearchQuery] = useState("");

  // Handler for product image upload (with compression)
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(lang === 'en' ? "Image too large! Max 2MB." : "Sawirka waa uu weyn yahay! Max 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new (window as any).Image();
        img.src = reader.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; // Slightly larger for products
          const MAX_HEIGHT = 400;
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setFormData(prev => ({ ...prev, image_url: dataUrl }));
          toast.success(lang === 'en' ? "Image uploaded & optimized!" : "Sawirka waa la habeeyay!");
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatus = (stock: number) => {
    if (stock === 0) return "Out of Stock";
    if (stock < 10) return "Low Stock";
    return "In Stock";
  };

  const getTranslatedStatus = (statusEn: string) => {
    if (statusEn === "Out of Stock") return t('out_of_stock') || "Out of Stock";
    if (statusEn === "Low Stock") return t('low_stock') || "Low Stock";
    return t('in_stock') || "In Stock";
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Get Tenant ID
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (roleError) {
      console.error("ROLE FETCH ERROR:", roleError);
      if (roleError.code === 'PGRST116') {
         setDebugError("Ma lehid wax Dukaan/Tenant ah! Fadlan koodhka Trigger-ka hubi. (No rows found)");
      } else {
         setDebugError(roleError.message);
      }
    }

    if (roleData) {
      setTenantId(roleData.tenant_id);
      // Fetch Products
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (products) {
        setInventory(products.map((p: any) => ({
          id: p.id,
          sku: p.sku || '',
          name: p.name,
          stock: p.stock,
          price: p.price.toString(),
          status: getStatus(p.stock)
        })));
      }
    }
    setIsLoading(false);
  };
  
  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Barcode Scanning Logic for Filling SKU
  useEffect(() => {
    if (!isAddOpen && !isEditOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if an actual input is focused, unless we want to catch it globally
      // But for SKU, it's safe to capture globally if not inside a text area
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).name !== 'sku') {
         // Allow typing in other inputs
      }

      const currentTime = new Date().getTime();
      
      // Hardware scanners usually hit 'Enter' at the end of the barcode
      if (e.key === 'Enter' && barcodeBuffer.length > 2) {
         setFormData(prev => ({ ...prev, sku: barcodeBuffer }));
         toast.success(lang === 'en' ? `Barcode Scanned: ${barcodeBuffer}` : `Barcode-ka waa la aqoonsaday: ${barcodeBuffer}`);
         setBarcodeBuffer("");
         
         // Prevent form submission if we happen to be in an input
         e.preventDefault();
         return;
      }

      // Scanner speed check (<50ms per key)
      if (currentTime - lastKeyTime > 50) {
         setBarcodeBuffer(e.key);
      } else {
         setBarcodeBuffer(prev => prev + e.key);
      }
      setLastKeyTime(currentTime);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddOpen, isEditOpen, barcodeBuffer, lastKeyTime, lang]);

  const handleOpenAdd = () => {
    setFormData({ id: '', sku: '', name: '', price: '', stock: '', image_url: '' });
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!formData.name || !formData.sku || !formData.price || formData.stock === '') {
      toast.error(lang === 'en' ? "Please fill all fields. ⚠️" : "Fadlan buuxi dhammaan dhinacyada sheyga. ⚠️");
      return;
    }
    
    // Check if SKU exists
    if (inventory.some(p => p.sku.toUpperCase() === formData.sku.toUpperCase())) {
      toast.error(lang === 'en' ? "SKU already exists!" : "SKU-gaan horay ayuu dukaanka ugu diiwaangashan yahay! Koodh kale keen.");
      return;
    }

    const stockNum = parseInt(formData.stock, 10);
    const productData = {
      tenant_id: tenantId,
      sku: formData.sku.toUpperCase(),
      name: formData.name,
      price: parseFloat(formData.price || "0"),
      stock: isNaN(stockNum) ? 0 : stockNum,
      image_url: formData.image_url || null,
    };

    const { data, error } = await supabase.from('products').insert([productData]).select().single();

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setInventory((prev) => [{
        id: data.id,
        sku: data.sku || '',
        name: data.name,
        price: data.price.toString(),
        stock: data.stock,
        status: getStatus(data.stock)
      }, ...prev]);
    }
    
    setIsAddOpen(false);
    toast.success(lang === 'en' ? "Product added successfully! 🛒" : "Badeeco cusub si guul leh baa kaydka loogu daray! 🛒");
  };

  const handleOpenEdit = (product: Product & { image_url?: string }) => {
    setFormData({ 
      id: product.id,
      sku: product.sku, 
      name: product.name, 
      price: product.price, 
      stock: product.stock.toString(),
      image_url: product.image_url || ''
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.price || formData.stock === '') {
      toast.error(lang === 'en' ? "Please fill all fields. ⚠️" : "Fadlan ha ka tegin wax banaan. ⚠️");
      return;
    }
    const stockNum = parseInt(formData.stock, 10);
    
    const { error } = await supabase.from('products')
      .update({
        sku: formData.sku.toUpperCase(),
        name: formData.name,
        price: parseFloat(formData.price || "0"),
        stock: isNaN(stockNum) ? 0 : stockNum,
        image_url: formData.image_url || null,
      })
      .eq('id', formData.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setInventory((prev) => prev.map(p => {
      if (p.id === formData.id) {
        return {
          ...p,
          sku: formData.sku.toUpperCase(),
          name: formData.name,
          price: parseFloat(formData.price || "0").toFixed(2),
          stock: isNaN(stockNum) ? 0 : stockNum,
          status: getStatus(isNaN(stockNum) ? 0 : stockNum)
        };
      }
      return p;
    }));
    setIsEditOpen(false);
    toast.success(lang === 'en' ? "Product updated successfully! ✅" : "Macluumaadka badeecada waa la cusboonaysiiyay! ✅");
  };

  const handleDelete = async (id: string) => {
    if (confirm(lang === 'en' ? "Are you sure you want to delete this product?" : "Ma hubtaa inaad badeecadan tirtirto?")) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        setInventory(prev => prev.filter(p => p.id !== id));
        toast.success(lang === 'en' ? "Product deleted" : "Waa la tirtiray!");
      } else {
         toast.error(error.message);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#141b2d]">{t('inventory_title')}</h2>
          <p className="text-zinc-500 font-medium mt-2">{t('inventory_desc')}</p>
          {debugError && (
             <p className="text-red-500 font-bold bg-red-50 p-3 mt-3 rounded-xl border border-red-100 text-sm">
                 ⚠️ Cillad: {debugError}
             </p>
          )}
        </div>
        <Button 
           onClick={handleOpenAdd}
           disabled={isLoading || !tenantId}
           type="button"
           className="bg-[#141b2d] hover:bg-blue-600 text-white rounded-2xl shadow-xl shadow-[#141b2d]/10 h-14 px-8 text-base font-extrabold transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <PlusCircle className="mr-2.5 h-6 w-6" /> {t('add_product')}
        </Button>
      </div>

      <div className="bg-white border border-zinc-100 rounded-3xl p-2 mb-8 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-zinc-400" />
            <Input 
              placeholder={lang === 'en' ? "Search by Name or SKU..." : "Ku raadi Magac ama SKU..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 h-14 bg-transparent border-none focus-visible:ring-0 text-base font-semibold text-[#141b2d] placeholder:text-zinc-400 placeholder:font-medium"
            />
          </div>
      </div>

      <div className="border border-zinc-100 rounded-3xl overflow-hidden bg-white shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[800px] lg:min-w-full">
          <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-100 bg-[#f9f9fb] hover:bg-[#f9f9fb]">
              <TableHead className="text-zinc-400 font-extrabold uppercase text-[10px] tracking-widest px-6 py-4">{t('sku')}</TableHead>
              <TableHead className="text-zinc-400 font-extrabold uppercase text-[10px] tracking-widest px-6">{t('name')}</TableHead>
              <TableHead className="text-zinc-400 font-extrabold uppercase text-[10px] tracking-widest px-6">{t('price')}</TableHead>
              <TableHead className="text-zinc-400 font-extrabold uppercase text-[10px] tracking-widest px-6">{t('stock')}</TableHead>
              <TableHead className="text-zinc-400 font-extrabold uppercase text-[10px] tracking-widest px-6">{t('status')}</TableHead>
              <TableHead className="text-right text-zinc-400 font-extrabold uppercase text-[10px] tracking-widest px-6">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow>
                 <TableCell colSpan={6} className="text-center py-10 text-zinc-500 font-medium">Loading Inventory...</TableCell>
               </TableRow>
             ) : filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-zinc-500 font-medium">No results found for "{searchQuery}"</TableCell>
                </TableRow>
             ) : filteredInventory.map((item) => (
              <TableRow key={item.id} className="border-b border-zinc-100 hover:bg-[#f9f9fb] transition-colors group">
                <TableCell className="font-extrabold text-zinc-400 px-6 uppercase tracking-wider">{item.sku}</TableCell>
                <TableCell className="font-extrabold text-[#141b2d] px-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 shrink-0 bg-white border border-zinc-100 shadow-sm rounded-xl overflow-hidden flex items-center justify-center p-0.5">
                       <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&size=100&font-size=0.4`} alt={item.name} className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform" />
                    </div>
                    <span>{item.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-[#141b2d] font-black px-6">${item.price}</TableCell>
                <TableCell className="text-zinc-500 font-black px-6">{item.stock}</TableCell>
                <TableCell className="px-6">
                  <Badge 
                    variant="outline"
                    className={
                        item.stock > 10 ? "bg-green-50 text-green-600 ring-1 ring-green-500/20 border-transparent font-bold px-3 py-1" : 
                        item.stock === 0 ? "bg-red-50 text-red-600 ring-1 ring-red-500/20 border-transparent font-bold px-3 py-1" : 
                        "bg-yellow-50 text-yellow-600 ring-1 ring-yellow-500/20 border-transparent font-bold px-3 py-1"
                    }
                  >
                    {getTranslatedStatus(item.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right px-6">
                  <div className="flex items-center justify-end space-x-2 transition-opacity">
                    <Button 
                      type="button"
                      onClick={() => handleOpenEdit(item)} 
                      variant="outline" 
                      size="icon" 
                      className="border-zinc-200 text-zinc-500 rounded-xl hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-sm"
                    >
                       <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      type="button"
                      onClick={() => handleDelete(item.id)} 
                      variant="outline" 
                      size="icon" 
                      className="border-zinc-200 text-zinc-500 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 hover:shadow-sm"
                    >
                       <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
       </div>
      </div>

      {/* --- ADD PRODUCT DIALOG --- */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#141b2d]">{t('add_new_product')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600">{t('product_name')}</label>
              <Input 
                 placeholder="Leather Jacket"
                 className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                 value={formData.name}
                 onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600 flex justify-between items-center">
                 <span>{t('sku')} (Scan Barcode here)</span>
                 <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-zinc-500 hover:text-blue-600" onClick={() => setIsCameraOpen(!isCameraOpen)}>
                    <Camera className="h-4 w-4 mr-1" />
                    {isCameraOpen ? "Xidh Kamarada" : "Daar Kamarada!"}
                 </Button>
              </label>

              {isCameraOpen ? (
                 <div className="mb-2 w-full flex justify-center">
                   <BarcodeScannerCamera 
                      onScan={(decodedText) => {
                         setFormData({...formData, sku: decodedText});
                         setIsCameraOpen(false);
                         toast.success(lang === 'en' ? "Barcode Captured!" : "Barcode waa lasoo qabtay!");
                      }} 
                      onClose={() => setIsCameraOpen(false)}
                      title={lang === 'en' ? 'Scan Product Barcode' : 'Sawir Koodhka Alaabta (Barcode)'}
                   />
                 </div>
              ) : (
                <Input 
                  name="sku"
                  placeholder="Scan Barcode or Type PRD-005"
                  className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d] uppercase"
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-bold text-zinc-600">{t('price')} ($)</label>
                <Input 
                   type="number"
                   placeholder="120.00"
                   className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                   value={formData.price}
                   onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-bold text-zinc-600">{t('stock')}</label>
                <Input 
                   type="number"
                   placeholder="12"
                   className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                   value={formData.stock}
                   onChange={(e) => setFormData({...formData, stock: e.target.value})}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600 flex justify-between items-center">
                <span>{lang === 'en' ? 'Product Image' : 'Sawirka Badeecada'}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    if (!formData.name) {
                      toast.error(lang === 'en' ? "Enter name first!" : "Magaca horta qor!");
                      return;
                    }
                    const lowerName = formData.name.toLowerCase();
                    const finalUrl = `https://loremflickr.com/400/400/${encodeURIComponent(lowerName)}`;
                    setFormData({...formData, image_url: finalUrl});
                    toast.success(lang === 'en' ? "Generated!" : "Waa la diyaariyay!");
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Auto-Find
                </Button>
              </label>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input 
                    placeholder="URL or Upload -->"
                    className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  />
                </div>
                <div className="w-12 h-11 relative bg-[#141b2d] rounded-xl flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
                  <Camera className="text-white h-5 w-5" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProductImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)} className="rounded-xl h-11">{t('cancel')}</Button>
            <Button type="button" onClick={handleAddSubmit} className="bg-[#141b2d] hover:bg-[#1f2945] text-white rounded-xl h-11 px-6">{t('save_product')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- EDIT PRODUCT DIALOG --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#141b2d]">{t('edit_product')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600">{t('product_name')}</label>
              <Input 
                 className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                 value={formData.name}
                 onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600 flex justify-between items-center">
                 <span>{t('sku')}</span>
                 <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-zinc-500 hover:text-blue-600" onClick={() => setIsCameraOpen(!isCameraOpen)}>
                    <Camera className="h-4 w-4 mr-1" />
                    {isCameraOpen ? "Xidh Kamarada" : "Daar Kamarada!"}
                 </Button>
              </label>

              {isCameraOpen ? (
                 <div className="mb-2 w-full flex justify-center">
                   <BarcodeScannerCamera 
                      onScan={(decodedText) => {
                         setFormData({...formData, sku: decodedText});
                         setIsCameraOpen(false);
                         toast.success(lang === 'en' ? "Barcode Captured!" : "Barcode waa lasoo qabtay!");
                      }} 
                      onClose={() => setIsCameraOpen(false)}
                      title={lang === 'en' ? 'Scan Product Barcode' : 'Sawir Koodhka Alaabta (Barcode)'}
                   />
                 </div>
              ) : (
                <Input 
                   className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d] uppercase"
                   value={formData.sku}
                   onChange={(e) => setFormData({...formData, sku: e.target.value})}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-bold text-zinc-600">{t('price')} ($)</label>
                <Input 
                   type="number"
                   className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                   value={formData.price}
                   onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-bold text-zinc-600">{t('stock')}</label>
                <Input 
                   type="number"
                   className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                   value={formData.stock}
                   onChange={(e) => setFormData({...formData, stock: e.target.value})}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-zinc-600 flex justify-between items-center">
                <span>{lang === 'en' ? 'Product Image' : 'Sawirka Badeecada'}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    const lowerName = formData.name.toLowerCase();
                    const finalUrl = `https://loremflickr.com/400/400/${encodeURIComponent(lowerName)}`;
                    setFormData({...formData, image_url: finalUrl});
                    toast.success(lang === 'en' ? "New image found!" : "Sawir cusub baa loo helay!");
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Auto-Find
                </Button>
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input 
                    placeholder="URL or Upload -->"
                    className="bg-[#f9f9fb] h-11 border-zinc-200 text-[#141b2d]"
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  />
                </div>
                <div className="w-12 h-11 relative bg-[#141b2d] rounded-xl flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
                  <Camera className="text-white h-5 w-5" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProductImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl h-11">{t('cancel')}</Button>
            <Button type="button" onClick={handleEditSubmit} className="bg-[#141b2d] hover:bg-[#1f2945] text-white rounded-xl h-11 px-6">{t('update_details')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
