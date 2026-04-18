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
    const q = query.toLowerCase();
    
    if (language === 'so') {
      if (q.includes('sawir') || q.includes('image') || q.includes('img')) {
        return "Si aad sawir ugu darto badeecada, tag Inventory, riix 'Add Product' ama 'Edit', kadibna riix calaamada kamarada (camera icon). Waxaan hadda ku daray 'Image Compressor' si sawiradu uusan error u bixin.";
      }
      if (q.includes('dhib') || q.includes('error') || q.includes('cilad')) {
        return "Haddii aad cilad aragto, fadlan hubi internet-kaaga ama isku day inaad 'Refresh' gareeyo bogga. Sidoo kale, xogta profile-ka hadda waxay ku kaydsan tahay Supabase Cloud markaa ma lumayso.";
      }
      if (q.includes('iib') || q.includes('pos')) {
        return "Bogga POS-ka waxaa loogu talagalay iibka degdega ah. Waxaad isticmaali kartaa 'Barcode Scanner' ama kamarada taleefankaaga si aad badeecada u aqoonsato.";
      }
      if (q.includes('magac') || q.includes('profile')) {
        return "Si aad u badasho magacaaga ama sawirkaaga, riix profile-kaaga geeska sare (Dashboard ama POS), kadibna dooro 'Edit Profile'.";
      }
      return "Waan ku maqlayaa. Dukaan Pro AI ahaan, waxaan halkan u joogaa inaan dukaankaaga kaa caawiyo. Ma rabtaa inaan kaa caawiyo Inventory-ga, Sales-ka, mise Profile-ka?";
    } else {
      // English responses
      if (q.includes('image') || q.includes('photo')) {
        return "To add an image, go to Inventory and use the Camera Icon. We've added optimization so large photos won't cause errors anymore.";
      }
      if (q.includes('error') || q.includes('issue')) {
        return "Most common errors are now handled by our smart compression. If you see a persistence issue, rest assured profile data is now synced with Supabase Cloud.";
      }
      return "I'm here to help! I can assist with inventory management, POS usage, or setting up your store profile. What's on your mind?";
    }
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
