'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { RefreshCw } from 'lucide-react';

interface BarcodeScannerCameraProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
  title?: string;
}

export default function BarcodeScannerCamera({ onScan, onClose, title = "Scan Barcode" }: BarcodeScannerCameraProps) {
  const [isError, setIsError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCamIdx, setCurrentCamIdx] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("html5-qr-reader", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.UPC_A,
      ],
      verbose: false
    });
    scannerRef.current = html5QrCode;

    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        
        let bestIdx = 0;
        // Search by label first
        for (let i = 0; i < devices.length; i++) {
           const lbl = devices[i].label.toLowerCase();
           if (lbl.includes("back") || lbl.includes("rear") || lbl.includes("environment")) {
              bestIdx = i;
              break;
           }
        }
        
        // If still 0 (front) but there are multiple cameras, often iOS puts back last
        if (bestIdx === 0 && devices.length > 1) {
           bestIdx = devices.length - 1; 
        }

        setCurrentCamIdx(bestIdx);
        startScannerWithId(devices[bestIdx].id, html5QrCode);
      } else {
         setIsError("Kamarad koombuyuutarka/Taleefanka wey ka maqan tahay.");
      }
    }).catch(err => {
      console.error(err);
      // Fallback: if getCameras throws an error (happens in some Safari versions), just force environment
      startScannerWithId({ facingMode: "environment" }, html5QrCode);
    });

    return () => {
      if (scannerRef.current?.isScanning) {
         scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  const startScannerWithId = (cameraIdOrObj: any, instance: Html5Qrcode) => {
      if (instance.isScanning) {
          instance.stop().then(() => {
             initStart(cameraIdOrObj, instance);
          }).catch(console.error);
      } else {
          initStart(cameraIdOrObj, instance);
      }
  };

  const initStart = (cameraIdOrObj: any, instance: Html5Qrcode) => {
    instance.start(
      cameraIdOrObj,
      { fps: 20, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        instance.stop().then(() => {
            onScan(decodedText);
        }).catch(err => {
            onScan(decodedText);
            console.error(err);
        });
      },
      (errorMessage) => { /* ignore */ }
    ).catch(err => {
        setIsError("Fadlan u fasax Browserka (Allow Camera) inuu shido kamaradda.");
        console.error("Initiation error:", err);
    });
  };

  const flipCamera = () => {
     if (cameras.length > 1 && scannerRef.current) {
        const nextIdx = (currentCamIdx + 1) % cameras.length;
        setCurrentCamIdx(nextIdx);
        setIsError(null);
        startScannerWithId(cameras[nextIdx].id, scannerRef.current);
     }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-zinc-200 w-full">
      <div className="flex w-full justify-between items-center mb-4">
        <h3 className="font-bold text-[#141b2d]">{title}</h3>
        {onClose && (
          <button onClick={onClose} className="text-zinc-400 hover:text-red-500 font-bold transition-colors">
            X (Xidh)
          </button>
        )}
      </div>
      
      {isError && (
         <div className="bg-red-50 text-red-600 p-3 mb-4 rounded-lg text-sm w-full font-bold">
           ⚠️ {isError}
         </div>
      )}

      {/* The scanner element */}
      <div className="relative w-full max-w-md bg-black rounded-xl overflow-hidden min-h-[250px] md:min-h-[300px]">
         {!isError && <span className="text-zinc-500 animate-pulse font-bold text-sm absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">Waa la furaayaa Kamarada...</span>}
         <div id="html5-qr-reader" className="absolute top-0 left-0 w-full h-full [&>video]:absolute [&>video]:top-0 [&>video]:left-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0 [&>canvas]:w-full [&>canvas]:h-full z-10" />
      </div>
      
      <div className="flex items-center justify-between w-full mt-4 max-w-md">
         <p className="text-xs text-zinc-500 font-medium">
            Ku beeg kamarada Khadka Alaabta.
         </p>
         
         {cameras.length > 1 && (
            <button 
               onClick={flipCamera} 
               className="flex items-center bg-zinc-100 hover:bg-zinc-200 text-[#141b2d] px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            >
               <RefreshCw className="h-4 w-4 mr-2" />
               Wareeji Kamarada
            </button>
         )}
      </div>
    </div>
  );
}
