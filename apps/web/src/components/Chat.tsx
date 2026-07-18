"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { chat, getApiBase, health } from "@/lib/api";
import type { ChatResponse, TradeProposal } from "@/lib/types";
import PreflightModal from "./PreflightModal";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  tools?: ChatResponse["tool_results"];
  mode?: string;
  model?: string;
  usage?: ChatResponse["usage"];
};

const QUICK = [
  "What looks good in the market for paper practice today?",
  "Quote AAPL — good setup or skip?",
  "Research NVDA and tell me if it's interesting",
  "Propose a limit buy of 1 share of SPY with your thesis",
  "Hold — nothing looks good right now",
];

const LOADING_STEPS = [
  "Waking the API…",
  "Talking to Grok…",
  "Fetching market data…",
  "Still working (first reply can take ~20s)…",
];

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

function toolSummary(tool: string, result: unknown): string {
  if (result == null || typeof result !== "object") {
    return "";
  }
  const r = result as Record<string, unknown>;
  if (tool === "get_quote") {
    const px = r.close ?? r.price ?? (r.trade as { p?: number } | undefined)?.p;
    const src = r.source ? ` · ${r.source}` : "";
    return px != null ? `${px}${src}` : "";
  }
  if (tool === "get_bars") {
    const bars = r.bars as unknown[] | undefined;
    const src = r.source ? String(r.source) : "";
    return bars ? `${bars.length} bars${src ? ` · ${src}` : ""}` : "";
  }
  if (tool === "get_news") {
    const news = r.news as unknown[] | undefined;
    const src = r.source ? String(r.source) : "";
    return news ? `${news.length} headlines${src ? ` · ${src}` : ""}` : "";
  }
  if (tool === "web_search") {
    const results = r.results as unknown[] | undefined;
    return results ? `${results.length} results` : "";
  }
  if (tool === "get_account") {
    const eq = r.equity ?? r.portfolio_value;
    return eq != null ? `equity ${eq}` : "";
  }
  if (tool === "propose_order") {
    return `${r.side || ""} ${r.qty || ""} ${r.symbol || ""}`.trim();
  }
  if (tool === "decide_hold") {
    return "hold logged";
  }
  return "";
}

export default function Chat(props: {
  onProposalSubmitted?: () => void;
  onActivity?: () => void;
}) {
  if (clerkEnabled) {
    return <ChatClerk {...props} />;
  }
  return <ChatBody isLoaded isSignedIn {...props} />;
}

function ChatClerk(props: {
  onProposalSubmitted?: () => void;
  onActivity?: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <ChatBody
      isLoaded={isLoaded}
      isSignedIn={Boolean(isSignedIn)}
      {...props}
    />
  );
}

function ChatBody({
  isLoaded,
  isSignedIn,
  onProposalSubmitted,
  onActivity,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
  onProposalSubmitted?: () => void;
  onActivity?: () => void;
}) {
  const locked = clerkEnabled && isLoaded && !isSignedIn;
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "system",
      text:
        "Chat with Grok to research symbols. If it proposes a trade, you confirm it — paper only.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHint, setLoadingHint] = useState(LOADING_STEPS[0]);
  const [proposal, setProposal] = useState<TradeProposal | null>(null);

  useEffect(() => {
    if (!busy) return;
    let i = 0;
    setLoadingHint(LOADING_STEPS[0]);
    const id = window.setInterval(() => {
      i = Math.min(i + 1, LOADING_STEPS.length - 1);
      setLoadingHint(LOADING_STEPS[i]);
    }, 4500);
    return () => window.clearInterval(id);
  }, [busy]);

  const sendText = useCallback(
    async (textRaw: string) => {
      const text = textRaw.trim();
      if (!text || busy) return;
      if (locked) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: "Sign in (top right) to use the desk.",
          },
        ]);
        return;
      }
      setInput("");
      setBusy(true);
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
      setMessages((m) => [...m, userMsg]);

      try {
        try {
          await health();
        } catch {
          /* still try chat */
        }
        const res = await chat(text);
        const modeLabel = [res.mode, res.provider, res.model]
          .filter(Boolean)
          .join(" · ");
        const assistant: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.assistant_text,
          tools: res.tool_results,
          mode: modeLabel || res.mode,
          model: res.model,
          usage: res.usage,
        };
        setMessages((m) => [...m, assistant]);
        onActivity?.();

        if (res.proposal && res.proposal.policy_status === "awaiting_confirm") {
          setProposal(res.proposal);
        } else if (
          res.proposal &&
          res.proposal.policy_status === "policy_rejected"
        ) {
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "system",
              text: `Policy rejected: ${res.proposal?.rejection_reason}`,
            },
          ]);
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Chat failed";
        const hint = /sign in|401|bearer|token/i.test(raw)
          ? raw
          : `${raw} (API: ${getApiBase()})`;
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: hint,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, locked, onActivity]
  );

  return (
    <div className="hud-panel flex h-full min-h-[min(70dvh,560px)] flex-col !p-0 overflow-hidden sm:min-h-[480px]">
      <div className="border-b border-line/80 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="hud-label">Chat · Grok</div>
            <h2 className="text-base font-semibold text-white">
              Practice with a research bro
            </h2>
            <p className="text-xs text-mist">
              Ask what looks good, get a paper proposal — practice first, real
              money later (elsewhere)
            </p>
          </div>
          {busy && (
            <span className="max-w-[14rem] rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-right font-mono text-xs text-accent">
              {loadingHint}
            </span>
          )}
        </div>
        {!locked && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void sendText(q)}
                className="rounded-full border border-line bg-ink/70 px-2.5 py-1 text-xs text-slate-300 transition hover:border-accent/50 hover:text-accent disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {locked && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-6 text-center">
            <p className="text-sm font-medium text-white">
              Sign in to open the desk
            </p>
            <p className="mt-1 text-xs leading-relaxed text-mist">
              Your paper book, chat, and proposals need a free account. No real
              money.
            </p>
            <div className="mt-4">
              <SignInButton mode="modal">
                <button type="button" className="hud-btn-primary">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto border border-accent/25 bg-accent/15 text-cyan-50"
                : m.role === "system"
                  ? "border border-line bg-ink/60 font-mono text-xs text-mist"
                  : "border border-line/60 bg-ink/80 text-slate-200"
            }`}
          >
            {(m.mode || m.model) && (
              <div className="mb-1 font-mono text-xs uppercase tracking-wide text-slate-500">
                {m.mode}
                {m.model ? ` · ${m.model}` : ""}
              </div>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.tools && m.tools.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/80 pt-2">
                {m.tools.map((t, i) => {
                  const summary = t.ok ? toolSummary(t.tool, t.result) : t.error;
                  return (
                    <span
                      key={`${m.id}-${i}`}
                      title={
                        t.ok && t.result != null
                          ? JSON.stringify(t.result).slice(0, 400)
                          : t.error || t.tool
                      }
                      className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 font-mono text-xs ${
                        t.ok
                          ? "border-good/30 bg-good/5 text-slate-300"
                          : "border-bad/30 bg-bad/5 text-bad"
                      }`}
                    >
                      <span className={t.ok ? "text-good" : "text-bad"}>
                        {t.ok ? "✓" : "✗"}
                      </span>
                      <span className="text-slate-400">{t.tool}</span>
                      {summary ? (
                        <span className="truncate text-slate-500">
                          {summary}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="rounded-xl border border-line/60 bg-ink/50 px-3 py-2 text-xs text-mist">
            <div className="mb-1.5 flex gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
            </div>
            {loadingHint}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-line/80 bg-ink/90 p-3 backdrop-blur-md supports-[backdrop-filter]:bg-ink/75">
        <form
          className="flex items-stretch gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              locked
                ? "Sign in to chat…"
                : "Quote AAPL or propose SPY…"
            }
            enterKeyHint="send"
            autoComplete="off"
            className="min-h-11 flex-1 rounded-xl border border-line bg-ink/90 px-3 py-2.5 text-base text-white outline-none placeholder:text-slate-600 focus:border-accent/50 sm:text-sm"
            disabled={busy || locked}
          />
          <button
            type="submit"
            disabled={busy || locked || !input.trim()}
            className="hud-btn-primary min-h-11 shrink-0 px-4 disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>

      {proposal && (
        <PreflightModal
          proposal={proposal}
          onClose={(updated) => {
            setProposal(null);
            if (updated?.policy_status === "submitted") {
              setMessages((m) => [
                ...m,
                {
                  id: crypto.randomUUID(),
                  role: "system",
                  text: `Paper order submitted. broker_order_id=${updated.broker_order_id}`,
                },
              ]);
              onProposalSubmitted?.();
            } else if (updated?.policy_status === "cancelled") {
              setMessages((m) => [
                ...m,
                {
                  id: crypto.randomUUID(),
                  role: "system",
                  text: "Proposal rejected / cancelled.",
                },
              ]);
            }
          }}
        />
      )}
    </div>
  );
}
