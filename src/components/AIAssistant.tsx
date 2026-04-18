'use client';

import { useState, useEffect, useRef } from "react";
import { 
  Bot, X, Send, Sparkles, MessageSquare, 
  HelpCircle, Zap, ShieldAlert, ShoppingBag, 
  ChevronRight, BrainCircuit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function AIAssistant() {
  const { lang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: lang === 'en' 
        ? "Hello! I am your Dukaan Pro AI Assistant. How can I help you manage your store today?" 
        : "Haye! Waxaan ahay Dukaan Pro AI Assistant. Sideen kuu caawin karaa maanta si aad dukaankaaga u maamusho?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI Response logic (Knowledge Base)
    setTimeout(() => {
      const response = generateAIResponse(input, lang);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const generateAIResponse = (query: string, language: string): string => {
    const q = query.toLowerCase().trim();
    
    // Automatic Language Detection
    const somaliKeywords = [
      'ma', 'waa', 'sidee', 'ka', 'ku', 'iyo', 'yahay', 'tahay', 'jira', 'ilaa', 'ila', 'hagaaji', 'qabo', 'taqaan', 
      'hadashaa', 'bilaa', 'cusubahay', 'cilad', 'dhib', 'sawir', 'iib', 'lacag', 'macmiil', 'wax', 'qof', 'hag', 
      'iga', 'ilaa', 'halkan', 'soo', 'bixi', 'dhacay', 'tirtir', 'badal', 'cusboonaysii', 'haysataa', 'dhammaan',
      'dhex', 'leeyahay', 'aan', 'ee', 'isheeg', 'sheeg', 'war', 'isbaran'
    ];
    
    const queryWords = q.split(/\s+/);
    const isSomaliQuery = queryWords.some(word => somaliKeywords.includes(word));
    const effectiveLang = isSomaliQuery ? 'so' : language;

    // --- INTENT ROUTER ---
    
    // 1. GREETINGS & INTRODUCTIONS
    if (q.includes('hello') || q.includes('hi ') || q === 'hi' || q.includes('hay') || q.includes('asc') || q.includes('haye')) {
       return effectiveLang === 'so' 
         ? "Asc sxb! Aad baan ugu faraxsanahay inaan kula hadlo. Waxaan ahay Dukaan Pro AI, caawiyahaaga gaarka ah. Sideen kuu caawiyaa?"
         : "Hello there! I'm your Dukaan Pro AI Assistant. I can help you manage inventory, sales, or troubleshoot issues. How's your business going today?";
    }

    if (q.includes('introduce') || q.includes('what is') || q.includes('waa maxay') || q.includes('sharax')) {
       return effectiveLang === 'so'
         ? "Dukaan Pro waa nidaamka ugu casrisan ee POS & Inventory loogu talagalay ganacsiyada Soomaaliyeed. Waxaan kuu fududeeyay iibka (POS), kaydka (Inventory), maamulka macaamiisha, iyo dhib dhalinta Invoices-ka. Ma rabtaa inaan mid ka mid ah ku baro?"
         : "Dukaan Pro is a state-of-the-art POS and Inventory management system designed for modern retail. It handles multi-tenant SaaS features, real-time stock tracking, barcode scanning, and multi-currency sales. I am here to ensure you get the most out of it!";
    }

    // 2. PRODUCT & INVENTORY HELP
    if (q.includes('sawir') || q.includes('image') || q.includes('photo') || q.includes('picture')) {
       return effectiveLang === 'so'
         ? "Haddii aad dhib ku qabto sawirada: Tag 'Inventory', riix 'Edit' badeecada aad rabto, kadibna riix calaamada Kamarada (Camera icon). Hadda waxaan ku daray 'Smart Optimizer' oo sawirkaaga si toos ah u yaraynaya si uusan error u bixin. Ma u baahantahay inaan kuu tuso meesha uu ku yaal?"
         : "To manage product images, go to the Inventory section. Click 'Edit' on any product and use the new 'Smart Upload' camera button. It automatically optimizes and compresses your images to prevent any upload errors.";
    }

    if (q.includes('stock') || q.includes('inventory') || q.includes('badeecad') || q.includes('kayd')) {
       return effectiveLang === 'so'
         ? "Inventory-ga wuxuu kuu sahlayaa inaad ogaato inta badeeco kuu hartay. Waxaad ku dari kartaa badeeco cusub, waxaadna ku xiri kartaa Barcode. Haddii badeeco kaa dhammaato (Low Stock), nidaamka ayaa kuu sheegaya."
         : "The Inventory module tracks your stock levels in real-time. You can add SKUs, set low-stock thresholds, and track costs. Use the search bar in the Inventory page to find any item instantly.";
    }

    // 3. POS & SALES HELP
    if (q.includes('iib') || q.includes('pos') || q.includes('sale') || q.includes('sell')) {
       return effectiveLang === 'so'
         ? "Bogga POS waa wadnaha nidaamka. Waxaad ka iibin kartaa macaamiisha adigoo isticmaalaya Barcode ama magaca. Sidoo kale waxaad u kala dooran kartaa iib toos ah (Cash) ama deyn (Credit). Haddii aad rabto inaad Receipt-ka soo saarto, riix 'Complete Sale'."
         : "The POS (Point of Sale) page is where you handle transactions. You can scan barcodes, add items to the cart, and handle multiple payment methods including Cash, Mobile Money, and Debt (Credit).";
    }

    // 4. ERROR & TROUBLESHOOTING
    if (q.includes('cilad') || q.includes('error') || q.includes('problem') || q.includes('dhib') || q.includes('haysataa') || q.includes('issue')) {
       return effectiveLang === 'so'
         ? "Waan ka xumahay in cilad ku haysataa sxb. Badanaa ciladaha waxaa keena internet-ka oo daciif ah ama xog weyn. Isku day inaad bogga 'Refresh' gareeso (F5). Ciladihii hore ee sawirka iyo profile-ka oo luminayay hadda waan xalnay. Ma jiraa dhib kale?"
         : "If you encounter an issue, please try refreshing the page first. We've recently fixed image upload errors and data persistence issues. If something specific is wrong, let me know and I'll guide you!";
    }

    // 5. PERSONAL / CHATTY
    if (q.includes('ma taqaan') || q.includes('who are you') || q.includes('ayaad tahay') || q.includes('know somali')) {
       return effectiveLang === 'so'
         ? "Haa sxb! Af-Soomaaliga si fiican baan u aqaan, waanan ku fahamayaa. Waxaan ahay AI-gaaga gaarka ah ee Dukaan Pro. Waxaan ku baran karaa xogta ganacsigaaga."
         : "I am the Dukaan Pro AI, your digital assistant. I'm trained to understand both English and Somali to make your business management seamless.";
    }

    if (q.includes('thank') || q.includes('mahadsanid')) {
       return effectiveLang === 'so' ? "Adaa mudan sxb! Mar walba halkan baan kuu joogaa." : "You're very welcome! I'm always here if you need more help.";
    }

    // 6. FALLBACK (SMART CATCH-ALL)
    return effectiveLang === 'so'
      ? "Waan kaa raali galinayaa sxb, su'aashaas si buuxda uma fahmin. Laakiin waxaan kaa caawin karaa: 1. Inventory, 2. POS Iibka, 3. Invoices, ama 4. Profile Edit. Midkee ayaad rabtaa?"
      : "I'm not quite sure about that specific request, but I can help you with Inventory, POS Sales, Invoices, or Profile management. Which one would you like to explore?";
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      {/* TRIGGER BUTTON */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="h-16 w-16 bg-[#141b2d] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group relative border-4 border-white"
        >
          <BrainCircuit className="h-8 w-8 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-blue-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
      )}

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="w-[350px] sm:w-[400px] h-[550px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-zinc-100 animate-in slide-in-from-bottom-10 fade-in duration-300">
          
          {/* HEADER */}
          <div className="bg-[#141b2d] p-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-400/30">
                <Sparkles className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Dukaan AI Assistant</h3>
                <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase">Online & Smart</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
               <X className="h-6 w-6" />
            </button>
          </div>

          {/* MESSAGES AREA */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f9f9fb] custom-scrollbar">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
                  m.role === 'user' 
                    ? "bg-[#141b2d] text-white rounded-tr-none" 
                    : "bg-white text-zinc-700 border border-zinc-100 rounded-tl-none"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-zinc-100 p-3 rounded-2xl rounded-tl-none flex space-x-1">
                   <div className="h-2 w-2 bg-zinc-300 rounded-full animate-bounce"></div>
                   <div className="h-2 w-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                   <div className="h-2 w-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* QUICK ACTIONS */}
          <div className="px-4 py-2 bg-[#f9f9fb] flex gap-2 overflow-x-auto no-scrollbar border-t border-zinc-100">
            <button 
              onClick={() => setInput(lang === 'en' ? "How to add image?" : "Sidee sawir loogu daraa?")}
              className="whitespace-nowrap bg-white border border-zinc-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-500 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
            >
              {lang === 'en' ? "Image Help" : "Caawinaad Sawir"}
            </button>
            <button 
              onClick={() => setInput(lang === 'en' ? "Fix my errors" : "Ciladaha iga saar")}
              className="whitespace-nowrap bg-white border border-zinc-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-500 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
            >
              {lang === 'en' ? "Fix Errors" : "Hagaaji Cilada"}
            </button>
          </div>

          {/* INPUT AREA */}
          <div className="p-4 bg-white border-t border-zinc-100">
            <div className="relative">
              <input 
                type="text"
                placeholder={lang === 'en' ? "Type a message..." : "Wax qor..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full pl-4 pr-12 py-3 bg-[#f9f9fb] border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-[#141b2d]"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-[#141b2d] text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
