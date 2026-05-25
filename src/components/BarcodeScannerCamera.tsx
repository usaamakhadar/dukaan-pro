'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { RefreshCw } from 'lucide-react';
import { playSuccessBeep } from '@/lib/barcode/scanner-audio';


interface CameraDevice {
  id: string;
  label: string;
}

interface BarcodeScannerCameraProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
  title?: string;
}

export default function BarcodeScannerCamera({ onScan, onClose, title = "Scan Barcode" }: BarcodeScannerCameraProps) {
  const [isError, setIsError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCamIdx, setCurrentCamIdx] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const initStart = useCallback((cameraIdOrObj: string | MediaTrackConstraints, instance: Html5Qrcode) => {
    // Construct camera constraints to force High Definition (720p/1080p)
    const constraints = typeof cameraIdOrObj === 'string'
      ? {
          deviceId: { exact: cameraIdOrObj },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      : {
          facingMode: "environment",
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        };

    const tryStart = (c: string | MediaTrackConstraints, isFallback: boolean) => {
      instance.start(
        c,
        { 
          fps: 30, 
          qrbox: (width, height) => {
            // For barcode scanning, we want a wider box so the barcode fits easily.
            const widthBox = Math.floor(width * 0.85);
            const heightBox = Math.floor(height * 0.40);
            return { width: widthBox, height: heightBox };
          },
          aspectRatio: 1.7777778
        },
        (decodedText) => {
           const now = Date.now();
           const cleanCode = decodedText.trim();
           
           if (cleanCode !== lastScannedCodeRef.current || (now - lastScanTimeRef.current) > 2000) {
              lastScannedCodeRef.current = cleanCode;
              lastScanTimeRef.current = now;
              
              playSuccessBeep();
              onScan(decodedText);
           }
        },
        () => { /* ignore */ }
      ).catch(err => {
          if (!isFallback) {
             console.warn("HD constraints failed, falling back to basic constraints", err);
             // Basic fallback constraints
             const fallbackConstraints = typeof cameraIdOrObj === 'string'
               ? { deviceId: { exact: cameraIdOrObj } }
               : { facingMode: "environment" };
             tryStart(fallbackConstraints, true);
          } else {
             const errorName = err instanceof Error ? err.name : String(err);
             const errorMsg = err instanceof Error ? err.message : String(err);
             
             if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
                setIsError("Fadlan u fasax Browserka (Allow Camera) inuu shido kamaradda.");
             } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
                setIsError("Kamaradu wey mashquulsan tahay (Busy). Waxaa laga yaabaa in tab kale ama app kale uu isticmaalayo.");
             } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
                setIsError("Wax kamarad ah oo shaqaynaya lama helin.");
             } else {
                setIsError(`Khalad ka dhacay shidista kamarada: ${errorMsg}`);
             }
             console.error("Initiation error:", err);
          }
      });
    };

    tryStart(constraints, false);
  }, [onScan]);

  const startScannerWithId = useCallback((cameraIdOrObj: string | MediaTrackConstraints, instance: Html5Qrcode) => {
      if (instance.isScanning) {
          instance.stop().then(() => {
             initStart(cameraIdOrObj, instance);
          }).catch(console.error);
      } else {
          initStart(cameraIdOrObj, instance);
      }
  }, [initStart]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsError("Browser-kaaga ma taageero kamarad baadhista (HTTPS ayaa loo baahan yahay).");
      return;
    }

    const html5QrCode = new Html5Qrcode("html5-qr-reader", {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE
      ],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
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
  }, [onScan, startScannerWithId]);

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
         <div id="html5-qr-reader" className="absolute top-0 left-0 w-full h-full [&>video]:absolute [&>video]:top-0 [&>video]:left-0 [&>video]:w-full [&>video]:h-full [&>video]:object-contain [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0 [&>canvas]:w-full [&>canvas]:h-full z-10" />
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
