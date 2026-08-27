"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserPlus, Check } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { PageTransition } from "@/components/PageTransition";
import { useAuth } from "@/lib/AuthContext";
import { addFriendByToken } from "@/lib/api";

// Social feature — deep-link handler for the QR's own encoded URL
// (https://app.antara.money/add-friend/{token}), for the case someone
// opens that link directly (outside the in-app camera scanner) — e.g. a
// QR scanned by their phone's system camera app, or the link shared any
// other way. Two real states to handle: signed in already (complete the
// add immediately), or not signed in yet (prompt sign-in first, then
// complete once the session exists — the token stays in the URL across the
// popup-based Google sign-in, no separate storage needed).
export default function AddFriendDeepLinkPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user, isDemoMode, signInWithGoogle } = useAuth();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [state, setState] = useState<"idle" | "adding" | "done" | "error">("idle");
  const [friendName, setFriendName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || isDemoMode || !token || attempted.current) return;
    attempted.current = true;
    setState("adding");
    addFriendByToken(user, token)
      .then((result) => {
        setFriendName(result.friend_display_name);
        setState("done");
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Couldn't add that friend.");
        setState("error");
      });
  }, [user, isDemoMode, token]);

  return (
    <MobileFrame immersive>
      <PageTransition>
        <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center mb-5">
            {state === "done" ? (
              <Check className="w-7 h-7 text-emerald-400" />
            ) : (
              <UserPlus className="w-7 h-7 text-primary-300" />
            )}
          </div>

          {!user || isDemoMode ? (
            <>
              <h1 className="text-lg font-medium text-white mb-1.5">Sign in to add this friend</h1>
              <p className="text-[13px] text-gray-500 max-w-[260px] mb-5">
                You need a real Antara account to add friends — sign in and this link will finish the job.
              </p>
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-white text-gray-900 font-bold text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                Continue with Google
              </button>
            </>
          ) : state === "adding" || state === "idle" ? (
            <>
              <h1 className="text-lg font-medium text-white mb-1.5">Adding your friend…</h1>
              <p className="text-[13px] text-gray-500">One sec.</p>
            </>
          ) : state === "done" ? (
            <>
              <h1 className="text-lg font-medium text-white mb-1.5">You&apos;re now friends{friendName ? ` with ${friendName}` : ""}</h1>
              <p className="text-[13px] text-gray-500 max-w-[260px] mb-5">
                They can see your archetype, streak, and badges — never any real amount.
              </p>
              <button
                onClick={() => router.replace("/profile")}
                className="h-11 px-6 rounded-2xl bg-primary-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Go to your profile
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-medium text-white mb-1.5">Couldn&apos;t add that friend</h1>
              <p className="text-[13px] text-gray-500 max-w-[260px] mb-5">{errorMsg}</p>
              <button
                onClick={() => router.replace("/profile")}
                className="h-11 px-6 rounded-2xl bg-white/5 text-gray-200 font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Back to profile
              </button>
            </>
          )}
        </div>
      </PageTransition>
    </MobileFrame>
  );
}
