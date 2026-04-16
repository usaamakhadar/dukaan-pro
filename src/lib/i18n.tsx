'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'so';

export type Translations = {
  [key in Language]: Record<string, string>
};

const translations: Translations = {
  en: {
    dashboard: "Dashboard",
    pos: "POS",
    inventory: "Inventory",
    invoices: "Invoices",
    customers: "Customers",
    expenses: "Expenses",
    settings: "Settings",
    new_sale: "New Sale",
    search_placeholder: "Search reports, features...",
    notifications: "Notifications",
    help: "Help",
    edit_profile: "Edit Profile",
    save_changes: "Save Changes",
    cancel: "Cancel",
    store_manager: "Store Manager",
    upload_picture: "Upload Profile Picture",
    new_name: "New Name",
    role: "Role",
    profile_instructions: "Change your Name, Role, and Profile Picture here.",
    
    // Overview
    overview: "Overview",
    overview_desc: "Check today's performance and store metrics.",
    total_revenue: "Total Revenue",
    subscriptions: "Subscriptions",
    sales: "Sales",
    active_now: "Active Now",
    recent_sales: "Sales & Profit Overview",
    top_products: "Top Products",
    units_sold: "Units Sold",

    // POS
    new_collection: "New Collection",
    new_collection_desc: "Curating the season's finest arrivals for the discerning customer.",
    all_items: "All Items",
    clothing: "Clothing",
    accessories: "Accessories",
    footwear: "Footwear",
    bags: "Bags",
    search_pos_placeholder: "Search products, SKUs, or orders...",
    guest_checkout: "Guest Checkout",
    assign_customer: "Assign Customer",
    current_order: "Current Order",
    walk_in: "WALK-IN",
    subtotal: "Subtotal",
    vat: "VAT",
    service_fee: "Service Fee",
    total_amount: "Total Amount",
    pay_print: "Pay & Print Receipt",
    save_draft: "Save Draft",
    discard: "Discard",
    apply: "Apply",
    applied: "Applied",
    voucher_placeholder: "Voucher Code (Try PROMO10)",
    voucher_applied: "10% VOUCHER APPLIED ✅",
    empty_cart: "Cart is empty.",
    empty_search: "No products found for",
    items: "items",

    // Inventory
    inventory_title: "Product Inventory",
    inventory_desc: "Manage SKUs, stock levels, and product data.",
    add_product: "Add Product",
    sku: "SKU",
    name: "Name",
    price: "Price",
    stock: "Stock",
    status: "Status",
    actions: "Actions",
    no_products: "No products in inventory.",
    edit: "Edit",
    in_stock: "In Stock",
    out_of_stock: "Out of Stock",
    low_stock: "Low Stock",
    add_new_product: "Add New Product",
    product_name: "Product Name",
    save_product: "Save Product",
    update_details: "Update Details",
    edit_product: "Edit Product",
  },
  so: {
    dashboard: "Xog-Gudbiye",
    pos: "Khasnad (POS)",
    inventory: "Kaydka",
    invoices: "Rasiidhada",
    customers: "Macaamiisha",
    expenses: "Kharashaadka",
    settings: "Maamulka",
    new_sale: "Iib Cusub",
    search_placeholder: "Raadi xogaha, alaabaha...",
    notifications: "Ogeysiint",
    help: "Caawinaad",
    edit_profile: "Badal Xogta",
    save_changes: "Kaydi Isbedelka",
    cancel: "Kansal",
    store_manager: "Maareeyaha",
    upload_picture: "Soo Geli Sawir (Upload)",
    new_name: "Magaca Cusub",
    role: "Doorka Shaqada",
    profile_instructions: "Halkan waxaad ka badali kartaa Magacaaga, Shaqadaada iyo Sawirkaaga.",

    // Overview
    overview: "Guudmar",
    overview_desc: "Eeg waxqabadka maanta iyo warbixinta dukaanka.",
    total_revenue: "Wadarta Dakhliga",
    subscriptions: "Rukummada",
    sales: "Iibka",
    active_now: "Firfircoon",
    recent_sales: "Iibka & Faa'iidada Isbuuca",
    top_products: "Alaabaha Loogu Jecelyahay",
    units_sold: "Xabo Baa La Iibiyay",

    // POS
    new_collection: "Alaabo Cusub",
    new_collection_desc: "Waxaan kuugu soo xulnay alaabihii ugu dambeeyay ee tayada lahaa.",
    all_items: "Dhammaan",
    clothing: "Dhar",
    accessories: "Qurxin",
    footwear: "Kabo",
    bags: "Shandad",
    search_pos_placeholder: "Raadi alaabta ama koodhka...",
    guest_checkout: "Iibsade Caadi ah",
    assign_customer: "Geli Macmiil",
    current_order: "Dalabka Hadda",
    walk_in: "SOO-GAL",
    subtotal: "Wadarta Hore",
    vat: "Cashuur",
    service_fee: "Lacagta Adeegga",
    total_amount: "Lacagta Guud",
    pay_print: "Bixi & Daabac Rasiidhka",
    save_draft: "Qabyo (Kaydi)",
    discard: "Tuur Dalabka",
    apply: "Dhaqangeli",
    applied: "Waa la dabaqay",
    voucher_placeholder: "Geli Koodh... (Tijaabi PROMO10)",
    voucher_applied: "10% WAA LAGA DHIMAY ✅",
    empty_cart: "Cart-ga waxba kuma jiraan.",
    empty_search: "Wax alaab ah lagama helin",
    items: "xabo",

    // Inventory
    inventory_title: "Kaydka Alaabta",
    inventory_desc: "Maamul tirada, caddadka kaydka ku jira, iyo qiimaha.",
    add_product: "Ku Dar Alaab",
    sku: "Koodhka (SKU)",
    name: "Magaca",
    price: "Qiimaha",
    stock: "Tirada",
    status: "Xaaladda",
    actions: "Tallaabo",
    no_products: "Wax alaab ah kuma jiraan kaydka.",
    edit: "Badal",
    in_stock: "Wuu Joogaa",
    out_of_stock: "Wuu Dhamaaday",
    low_stock: "Wuu Yaryahay",
    add_new_product: "Alaab Cusub Diiwaangeli",
    product_name: "Magaca Alaabta",
    save_product: "Kaydi Alaabta",
    update_details: "Xaqiiji Isbedelka",
    edit_product: "Badal Macluumaadka",
  }
};

const LanguageContext = createContext<{ t: (key: string) => string; lang: Language; setLang: (l: Language) => void } | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem('appLang');
      if (saved === 'en' || saved === 'so') setLang(saved);
    }
  }, []);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem('appLang', newLang);
    }
  };

  const t = (key: string) => {
    return translations[lang]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ t, lang, setLang: changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
