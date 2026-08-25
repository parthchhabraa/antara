"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { PageTransition } from "@/components/PageTransition";
import { fetchChatAnswer } from "@/lib/api";
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

export default function ChatPage() {
  const { user, isDemoMode, signInWithGoogle } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const canChat = !!user && !isDemoMode;

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const result = await fetchChatAnswer(user, text);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "antara", text: result.answer }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "antara",
          text: "Couldn't reach the chat assistant just now — try again in a moment.",
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <MobileFrame>
      <PageTransition className="h-full flex flex-col">
          <div className="pb-3 shrink-0">
            <h3 className="text-lg font-medium text-white m-0 mb-1.5">Ask Antara</h3>
            <p className="text-[13px] leading-relaxed text-gray-500 m-0">
              Real answers from your real data — including how the predictions themselves work.
            </p>
          </div>

          {!canChat ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-primary-500/10 border border-primary-500/25 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary-300" />
              </div>
              <p className="text-[13.5px] leading-relaxed text-gray-400 max-w-[260px]">
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
              <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-3 no-scrollbar">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-relaxed rounded-2xl ${
                          m.role === "user"
                            ? "bg-primary-600 text-white rounded-br-md"
                            : m.isError
                            ? "bg-rose-500/10 border border-rose-500/25 text-rose-200 rounded-bl-md"
                            : "bg-white/[0.06] text-gray-200 rounded-bl-md"
                        }`}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                  {sending && (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.06] flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-gray-500"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 pb-4 pt-2 border-t border-white/5 flex items-center gap-2">
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
                  placeholder="Ask about your spending…"
                  disabled={sending}
                  className="flex-1 h-11 px-4 rounded-full bg-white/5 border border-white/10 text-[13.5px] text-gray-100 placeholder:text-gray-600 outline-none focus:border-primary-500/60 disabled:opacity-60"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="w-11 h-11 shrink-0 rounded-full bg-primary-600 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
      </PageTransition>
    </MobileFrame>
  );
}
