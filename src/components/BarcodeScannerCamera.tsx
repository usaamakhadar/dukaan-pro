'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerCameraProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
  title?: string;
}

export default function BarcodeScannerCamera({ onScan, onClose, title = "Scan Barcode" }: BarcodeScannerCameraProps) {
  const [isError, setIsError] = useState<string | null>(null);

  useEffect(() => {
    // We create a unique ID for the scanner div
    const scannerId = "html5-qr-reader";
    
    const html5QrCode = new Html5Qrcode(scannerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false
    });

    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 20,    
            qrbox: { width: 300, height: 150 },
            videoConstraints: {
               width: { ideal: 1280 },
               height: { ideal: 720 },
               advanced: [{ focusMode: "continuous" } as any]
            }
          },
          (decodedText) => {
            html5QrCode.stop().then(() => {
              onScan(decodedText);
            }).catch(err => {
               onScan(decodedText);
               console.error("Failed to stop scanning.", err);
            });
          },
          (errorMessage) => {
            // Ignore normal non-detection frames
          }
        ).catch(err => {
            setIsError("Kamarada lama shidi karin, malaha waa Loo-diiday (Permission Denied).");
            console.error("Camera start error:", err);
        });
      } else {
        setIsError("Kamarad koombuyuutarka kuma xirna ama lama ogaan.");
      }
    }).catch(err => {
        setIsError("Fadlan u ogolaw Browser-ka inuu Kamarada isticmaalo.");
        console.error("Get cameras error:", err);
    });

    // Cleanup on unmount
    return () => {
      if (html5QrCode.isScanning) {
         html5QrCode.stop().catch(error => console.error("Failed to stop scanner.", error));
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-zinc-200">
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
      <div className="relative w-full max-w-md bg-black rounded-xl overflow-hidden min-h-[300px]">
         {!isError && <span className="text-zinc-500 animate-pulse font-bold text-sm absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">Waa la furaayaa Kamarada...</span>}
         <div id="html5-qr-reader" className="absolute top-0 left-0 w-full h-full [&>video]:absolute [&>video]:top-0 [&>video]:left-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0 [&>canvas]:w-full [&>canvas]:h-full z-10" />
      </div>
      
      <p className="text-xs text-zinc-500 font-medium mt-4 text-center">
        Ku beeg kamarada si toos ah Khadka Alaabta (Barcode) ama QR Code.
      </p>
    </div>
  );
}
