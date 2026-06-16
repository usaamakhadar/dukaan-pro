'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CsvImporterProps {
  type: 'products' | 'customers';
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  lang?: 'en' | 'so';
}

export default function CsvImporter({ type, tenantId, isOpen, onClose, onComplete, lang = 'so' }: CsvImporterProps) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const parseCSV = (text: string) => {
    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = text.split(/\r?\n/)[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    let delim = ',';
    if (semiCount > commaCount && semiCount > tabCount) {
      delim = ';';
    } else if (tabCount > commaCount && tabCount > semiCount) {
      delim = '\t';
    }

    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentField = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip double quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++; // Skip \n in \r\n
        row.push(currentField.trim());
        lines.push(row);
        row = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField || row.length > 0) {
      row.push(currentField.trim());
      lines.push(row);
    }
    return lines;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.csv')) {
        toast.error(lang === 'en' ? "Please upload a .csv file!" : "Fadlan soo gali fayl ah .csv!");
        return;
      }
      setFile(selected);
      setStatusMessage("");
    }
  };

  const handleImport = async () => {
    if (!file || !tenantId) return;
    setIsImporting(true);
    setStatusMessage(lang === 'en' ? "Reading file..." : "Faylka waa la akhrinayaa...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 1) {
          throw new Error(lang === 'en' ? "CSV file is empty!" : "Faylka CSV-ga waa eber!");
        }

        // Scan the first 15 rows to find the headers row (contains name/item/customer)
        let headerRowIndex = 0;
        let foundHeaders = false;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const rowMapped = rows[i].map(h => h.toLowerCase().trim().replace(/["']/g, ''));
          const hasName = rowMapped.some(h => h === 'name' || h === 'item' || h === 'product' || h === 'customer' || h === 'client');
          if (hasName) {
            headerRowIndex = i;
            foundHeaders = true;
            break;
          }
        }

        const headers = rows[headerRowIndex].map(h => h.toLowerCase().trim().replace(/["']/g, ''));
        const dataRows = rows.slice(headerRowIndex + 1).filter(r => r.length > 0 && r.some(cell => cell !== ''));

        setStatusMessage(lang === 'en' ? `Processing ${dataRows.length} rows...` : `Waxa la shaqaynayaa ${dataRows.length} xariiqood...`);

        const findIndexWithFallback = (keywords: string[]) => {
          // 1. Try exact match
          let idx = headers.findIndex(h => keywords.includes(h));
          if (idx !== -1) return idx;
          // 2. Try substring match (e.g. "cost (cr)" matches "cost")
          idx = headers.findIndex(h => keywords.some(k => h.includes(k)));
          return idx;
        };

        if (type === 'products') {
          // QuickBooks Header Mapping
          const nameIndex = findIndexWithFallback(['item', 'product', 'product/service', 'name']);
          const skuIndex = findIndexWithFallback(['sku', 'part number', 'number', 'code']);
          const barcodeIndex = findIndexWithFallback(['barcode', 'upc', 'ean']);
          const stockIndex = findIndexWithFallback(['qty', 'quantity', 'quantity on hand', 'stock']);
          const priceIndex = findIndexWithFallback(['price', 'rate', 'sales price']);
          const costIndex = findIndexWithFallback(['cost', 'purchase cost', 'purchase price']);

          if (nameIndex === -1) {
            throw new Error(lang === 'en' ? "Could not find 'Name' or 'Item' column!" : "Lama helin tiirka 'Name' ama 'Item'!");
          }

          const productsToInsert = dataRows.map((row, idx) => {
            const name = row[nameIndex];
            if (!name) return null; // skip invalid rows

            const sku = skuIndex !== -1 && row[skuIndex] ? row[skuIndex].toUpperCase() : `QB-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
            const barcode = barcodeIndex !== -1 && row[barcodeIndex] ? row[barcodeIndex].trim() : null;
            const stockVal = stockIndex !== -1 ? parseInt(row[stockIndex], 10) : 0;
            const priceVal = priceIndex !== -1 ? parseFloat(row[priceIndex].replace(/[^0-9.]/g, '')) : 0.0;
            const costVal = costIndex !== -1 ? parseFloat(row[costIndex].replace(/[^0-9.]/g, '')) : 0.0;

            return {
              tenant_id: tenantId,
              name,
              sku,
              barcode: barcode || null,
              stock: isNaN(stockVal) ? 0 : stockVal,
              price: isNaN(priceVal) ? 0.00 : priceVal,
              cost: isNaN(costVal) ? 0.00 : costVal,
            };
          }).filter(Boolean);

          if (productsToInsert.length === 0) {
             throw new Error(lang === 'en' ? "No valid products found to import." : "Wax badeecooyin sax ah oo la soo gelin karo lama helin.");
          }

          // Supabase Bulk Insert
          const { error } = await supabase.from('products').insert(productsToInsert);
          if (error) throw error;

          toast.success(lang === 'en' ? `Successfully imported ${productsToInsert.length} products! 🛒` : `Guul! Waxa la soo geliyay ${productsToInsert.length} badeecadood! 🛒`);
        } else {
          // Customers Header Mapping
          const nameIndex = findIndexWithFallback(['customer', 'name', 'full name', 'client']);
          const phoneIndex = findIndexWithFallback(['phone', 'telephone', 'mobile', 'contact']);
          const emailIndex = findIndexWithFallback(['email', 'email address']);
          const addressIndex = findIndexWithFallback(['address', 'city', 'location']);

          if (nameIndex === -1) {
            throw new Error(lang === 'en' ? "Could not find 'Name' or 'Customer' column!" : "Lama helin tiirka 'Name' ama 'Customer'!");
          }

          const customersToInsert = dataRows.map((row) => {
            const name = row[nameIndex];
            if (!name) return null;

            const phone = phoneIndex !== -1 && row[phoneIndex] ? row[phoneIndex].trim() : null;
            const email = emailIndex !== -1 && row[emailIndex] ? row[emailIndex].trim() : null;
            const address = addressIndex !== -1 && row[addressIndex] ? row[addressIndex].trim() : null;

            return {
              tenant_id: tenantId,
              name,
              phone,
              email,
              address
            };
          }).filter(Boolean);

          if (customersToInsert.length === 0) {
            throw new Error(lang === 'en' ? "No valid customers found to import." : "Wax macaamiil sax ah oo la soo gelin karo lama helin.");
          }

          const { error } = await supabase.from('customers').insert(customersToInsert);
          if (error) throw error;

          toast.success(lang === 'en' ? `Successfully imported ${customersToInsert.length} customers! 👤` : `Guul! Waxa la soo geliyay ${customersToInsert.length} macaamiil ah! 👤`);
        }

        onComplete();
        onClose();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to parse CSV file.");
        setStatusMessage(lang === 'en' ? `Error: ${err.message}` : `Khalad: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl bg-white border-zinc-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#141b2d] flex items-center">
            <FileSpreadsheet className="mr-2 h-6 w-6 text-emerald-600" />
            {type === 'products' ? (lang === 'en' ? 'QuickBooks Product Import' : 'Soo Geli QuickBooks (Badeecooyin)') : (lang === 'en' ? 'QuickBooks Customer Import' : 'Soo Geli QuickBooks (Macaamiil)')}
          </DialogTitle>
        </DialogHeader>

        <div className="relative py-6 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50 p-6 text-center group hover:border-emerald-500 transition-colors">
          <Upload className="h-10 w-10 text-zinc-400 group-hover:text-emerald-600 transition-colors mb-3" />
          <p className="text-sm font-semibold text-zinc-700 mb-1">
            {file ? file.name : (lang === 'en' ? 'Click to select QuickBooks CSV file' : 'Riix si aad u doorato QuickBooks CSV')}
          </p>
          <p className="text-xs text-zinc-400">
            {lang === 'en' ? 'Supported columns: Item/Name, SKU, Qty, Price, Cost' : 'Kooramada: Item/Name, SKU, Qty, Price, Cost'}
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isImporting}
          />
        </div>

        {statusMessage && (
          <div className="flex items-center text-xs font-bold text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
            {statusMessage.startsWith('Error') || statusMessage.startsWith('Khalad') ? (
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2 shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>
        )}

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={isImporting} className="rounded-xl h-11">
            {lang === 'en' ? 'Cancel' : 'Ka laabo'}
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isImporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 font-bold disabled:opacity-50"
          >
            {isImporting ? (lang === 'en' ? 'Importing...' : 'Waa la soo gelinayaa...') : (lang === 'en' ? 'Start Import' : 'Soo Geli Hada')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
