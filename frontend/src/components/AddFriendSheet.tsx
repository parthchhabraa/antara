"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "@/lib/motion";
import { User as FirebaseUser } from "firebase/auth";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { QrCode, ScanLine, Nfc, Check } from "lucide-react";
import { fetchFriendToken, addFriendByToken } from "@/lib/api";

interface AddFriendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onAdded: (friendDisplayName: string | null) => void;
}

const ADD_FRIEND_PATH_RE = /\/add-friend\/([A-Za-z0-9_-]+)/;

// QR is the universal, fully-working method (canvas-rendered via `qrcode`,
// decoded via `jsqr` against real camera frames — nothing server-rendered,
// nothing native). NFC is a progressive enhancement ONLY on
// NDEFReader-capable browsers (Android Chrome) — every other
// platform/browser never sees the NFC button at all, no broken affordance,
// no dead end. True cross-platform NFC (CoreNFC on iOS) would need a native
// Capacitor plugin — deliberately out of scope this session, flagged in
// REVIEW.md as a future native-app-only enhancement.
export const AddFriendSheet: React.FC<AddFriendSheetProps> = ({ isOpen, onClose, user, onAdded }) => {
  const [mode, setMode] = useState<"my-code" | "scan">("my-code");
  const [myToken, setMyToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcListening, setNfcListening] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handledRef = useRef(false); // guards against acting on the same decoded QR twice

  useEffect(() => {
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  useEffect(() => {
    if (!isOpen || !user) return;
    setMode("my-code");
    setScanError(null);
    handledRef.current = false;
    fetchFriendToken(user)
      .then((token) => {
        setMyToken(token);
        const url = `https://app.antara.money/add-friend/${token}`;
        return QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#e9e9ed", light: "#00000000" } });
      })
      .then(setQrDataUrl)
      .catch((err) => console.warn("Fetching friend token / rendering QR failed:", err));
  }, [isOpen, user]);

  const extractToken = (decodedText: string): string | null => {
    const match = decodedText.match(ADD_FRIEND_PATH_RE);
    return match ? match[1] : null;
  };

  const handleToken = async (token: string) => {
    if (handledRef.current || !user) return;
    handledRef.current = true;
    setAdding(true);
    setScanError(null);
    try {
      const result = await addFriendByToken(user, token);
      onAdded(result.friend_display_name);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Couldn't add that friend — try again.");
      handledRef.current = false;
    } finally {
      setAdding(false);
    }
  };

  // Camera scan loop — draws video frames to a canvas and runs jsQR against
  // the raw pixel data. Stops itself (camera released) the moment a code
  // decodes or the sheet closes/switches mode.
  useEffect(() => {
    if (!isOpen || mode !== "scan") {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        console.warn("Camera access failed:", err);
        setScanError("Couldn't access the camera — check permissions and try again.");
      }
    };

    const tick = () => {
      if (cancelled || handledRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            const token = extractToken(code.data);
            if (token) {
              handleToken(token);
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const startNfc = async () => {
    if (!nfcSupported || !user) return;
    setScanError(null);
    setNfcListening(true);
    try {
      // @ts-expect-error — NDEFReader isn't in TS's default DOM lib yet;
      // feature-detected above (`'NDEFReader' in window`) before this ever runs.
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (event: any) => {
        for (const record of event.message.records) {
          if (record.recordType === "url" || record.recordType === "text") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            const token = extractToken(text);
            if (token) handleToken(token);
          }
        }
      };
    } catch (err) {
      console.warn("NFC scan failed:", err);
      setScanError("Couldn't start NFC — falling back to QR is always available below.");
      setNfcListening(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.default}
            className="absolute left-0 right-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-[#1b1e2e] border-t border-white/10 shadow-2xl p-5 pb-9"
          >
            <div className="w-9 h-1 rounded-full bg-white/15 mx-auto mb-4" />

            <h5 className="text-lg font-medium text-white m-0 mb-3">Add a friend</h5>

            <div className="flex gap-1.5 p-1 rounded-2xl bg-white/[0.04] mb-4">
              <button
                type="button"
                onClick={() => setMode("my-code")}
                className={`flex-1 h-10 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  mode === "my-code" ? "bg-primary-600 text-white" : "text-gray-400"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                My code
              </button>
              <button
                type="button"
                onClick={() => setMode("scan")}
                className={`flex-1 h-10 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  mode === "scan" ? "bg-primary-600 text-white" : "text-gray-400"
                }`}
              >
                <ScanLine className="w-3.5 h-3.5" />
                Scan
              </button>
            </div>

            {!user ? (
              <p className="py-10 text-center text-xs text-gray-500">Sign in with a real account to add friends.</p>
            ) : mode === "my-code" ? (
              <div className="flex flex-col items-center py-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Your Antara friend code" className="w-56 h-56 rounded-2xl bg-[#0f1117]" />
                ) : (
                  <div className="w-56 h-56 rounded-2xl bg-white/5 animate-pulse" />
                )}
                <p className="text-[12.5px] text-gray-500 text-center mt-4 max-w-[240px]">
                  Have a friend open Scan and point their camera at this — friending completes the moment they scan
                  it, no separate accept step needed.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-2">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  {adding && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                  )}
                  <div className="absolute inset-6 border-2 border-primary-400/50 rounded-2xl pointer-events-none" />
                </div>
                {scanError && <p className="text-[12px] text-rose-300 text-center mt-3">{scanError}</p>}
                <p className="text-[12px] text-gray-500 text-center mt-3">Point your camera at your friend&apos;s code.</p>

                {nfcSupported && (
                  <button
                    type="button"
                    onClick={startNfc}
                    disabled={nfcListening}
                    className="mt-3 flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/5 border border-white/10 text-[12px] text-gray-300 disabled:opacity-60"
                  >
                    <Nfc className="w-3.5 h-3.5 text-primary-300" />
                    {nfcListening ? "Listening for NFC…" : "Or tap to add via NFC"}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full h-11 mt-5 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-200 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
