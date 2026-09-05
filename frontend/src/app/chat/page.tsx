"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Send, Sparkles, Plus, Mic, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { db } from "@/lib/firebase";
import { MobileFrame } from "@/components/MobileFrame";
import { AntaraMark } from "@/components/AntaraMark";
import { PageTransition } from "@/components/PageTransition";
import { fetchChatAnswer, isColdStart } from "@/lib/api";
import { CURRENT_APP_VERSION } from "@/lib/changelog";
import { Transaction } from "@/types";
import { useAuth } from "@/lib/AuthContext";

interface ChatMessage {
  id: string;
  role: "user" | "antara";
  text: string;
  isError?: boolean;
}

// The one static line in the whole transcript — everything Antara says
// after this comes straight from a real answer_chat() call, grounded in
// real Firestore data and the same prediction/confidence numbers the rest
// of the app uses. This greeting is just the empty-state opener, not a
// model output, so it never claims to know anything about the user yet.
const GREETING: ChatMessage = {
  id: "greeting",
  role: "antara",
  text:
    "Hey — ask me anything about your spending. What you've logged, why I'm predicting what I'm predicting, how sure I actually am about any of it. I'll only tell you what I actually know from your real data.",
};

// Real, backend-groundable follow-ups only — every one of these maps to a
// question answer_chat can actually answer from computed numbers it already
// has (see backend/app/ml/llm_features.py), not an arbitrary suggestion.
// The cold-start one only shows for an account that's actually cold-start
// (same isColdStart() the rest of the app already uses), so it's never
// shown to someone it doesn't apply to.
function buildSuggestions(coldStart: boolean): string[] {
  const base = ["How confident are you right now?", "What's driving my burn rate?"];
  if (coldStart) base.push("Why is this still an early estimate?");
  return base;
}

export default function ChatPage() {
  const { user, isDemoMode, signInWithGoogle } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const [liveTxs, setLiveTxs] = useState<Transaction[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Same live subscription pattern as page.tsx/graph/page.tsx — needed here
  // only to compute isColdStart() for the suggestion chips below, not to
  // render a transaction list.
  useEffect(() => {
    if (isDemoMode || !user) return;
    try {
      const txCol = collection(db, "users", user.uid, "transactions");
      const q = query(txCol, orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLiveTxs(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, "id">) })));
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore live query on Chat screen:", e);
    }
  }, [isDemoMode, user]);

  const coldStart = useMemo(() => isColdStart(liveTxs), [liveTxs]);
  const suggestions = useMemo(() => buildSuggestions(coldStart), [coldStart]);

  const canChat = !!user && !isDemoMode;

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending || !user) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const result = await fetchChatAnswer(user, text);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "antara", text: result.answer }]);
    } catch (e) {
      // Brief 4 (2026-09-05): fetchChatAnswer's error now carries the
      // backend's own human sentence (a real 429 for the daily cap, a
      // calm "handling another message" for a busy model) via
      // parseErrorDetail in lib/api.ts — surface that instead of a single
      // generic line that would otherwise say "unreachable" even when the
      // real reason is "you've hit today's limit."
      const message =
        e instanceof Error && e.message
          ? e.message
          : "Couldn't reach the chat assistant just now — try again in a moment.";
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "antara",
          text: message,
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const copyMessage = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1500);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  const toggleFeedback = (id: string, value: "up" | "down") => {
    setFeedback((prev) => {
      const next = { ...prev };
      if (next[id] === value) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });
  };

  const lastAntaraId = [...messages].reverse().find((m) => m.role === "antara")?.id;

  return (
    <MobileFrame>
      <PageTransition className="h-full flex flex-col">
        {/* Top bar — small model/version badge, WHOOP-coach-chat layout
            adapted to what Antara actually has: a real changelog version,
            not a hardcoded number that'll drift. */}
        <div className="flex items-center pb-3 shrink-0">
          <div className="flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full bg-white/[0.06] border border-white/10">
            <AntaraMark size={16} />
            <span className="text-xs font-medium text-gray-300">Antara · v{CURRENT_APP_VERSION}</span>
          </div>
        </div>

        {!canChat ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-primary-500/10 border border-primary-500/25 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-300" />
            </div>
            <p className="text-sm leading-relaxed text-gray-400 max-w-[260px]">
              {isDemoMode
                ? "Chat needs a real signed-in account — there's no real spending history to answer from in Demo Mode."
                : "Sign in to ask Antara about your own spending."}
            </p>
            {!isDemoMode && (
              <button
                onClick={signInWithGoogle}
                className="mt-1 h-10 px-5 rounded-full bg-primary-600 text-white text-sm font-bold active:scale-95 transition-transform"
              >
                Sign in with Google
              </button>
            )}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pb-3 no-scrollbar">
              <AnimatePresence initial={false}>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed rounded-lg rounded-br-sm bg-primary-600 text-white">
                        {m.text}
                      </div>
                    </motion.div>
                  ) : (
                    // Antara's responses render as plain flowing text on the
                    // transparent background, not a boxed bubble — closer to
                    // a conversational answer than a walled-off chat bubble.
                    <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pr-2">
                      <p className={`text-sm leading-relaxed m-0 ${m.isError ? "text-rose-300" : "text-gray-100"}`}>
                        {m.text}
                      </p>
                      {m.id !== "greeting" && (
                        <div className="flex items-center gap-1 mt-2">
                          <button
                            type="button"
                            onClick={() => copyMessage(m)}
                            className="w-7 h-7 rounded-sm flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
                            aria-label="Copy response"
                          >
                            {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFeedback(m.id, "up")}
                            className={`w-7 h-7 rounded-sm flex items-center justify-center transition-colors ${
                              feedback[m.id] === "up" ? "text-primary-300 bg-primary-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                            }`}
                            aria-label="Good response"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFeedback(m.id, "down")}
                            className={`w-7 h-7 rounded-sm flex items-center justify-center transition-colors ${
                              feedback[m.id] === "down" ? "text-rose-300 bg-rose-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                            }`}
                            aria-label="Bad response"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Suggested follow-ups — only under the latest real
                          answer, so a growing transcript doesn't repeat
                          them under every past message. */}
                      {m.id === lastAntaraId && !sending && (
                        <div className="flex gap-2 overflow-x-auto pt-3 -mx-1 px-1 no-scrollbar">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => send(s)}
                              className="flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-white/10 bg-white/[0.04] text-gray-300 active:opacity-70 transition-opacity"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )
                )}
                {sending && (
                  <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-gray-500"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input bar — one composer container (rounded-lg, not a full
                pill) with every control grouped inside it, Claude-style —
                not separate floating circular buttons either side of a
                pill field, which read closer to an Instagram DM composer
                than this app's own restrained language. "+" and mic stay
                visual parity only (no feature/real speech-to-text behind
                them this pass), same theme tokens throughout. */}
            <div className="shrink-0 pb-4 pt-2 border-t border-white/5">
              <div className="flex items-center gap-1 pl-1.5 pr-1.5 py-1.5 rounded-lg bg-white/5 border border-white/10 focus-within:border-primary-500/60 transition-colors">
                <button
                  type="button"
                  title="Coming soon"
                  className="w-8 h-8 shrink-0 rounded-sm flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                  aria-label="Add (coming soon)"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask Antara anything"
                  disabled={sending}
                  className="flex-1 min-w-0 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 outline-none disabled:opacity-60 py-1.5"
                />
                <button
                  type="button"
                  title="Coming soon"
                  className="w-8 h-8 shrink-0 rounded-sm flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                  aria-label="Voice input (coming soon)"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  className="w-8 h-8 shrink-0 rounded-sm bg-primary-600 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="Send"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </PageTransition>
    </MobileFrame>
  );
}
