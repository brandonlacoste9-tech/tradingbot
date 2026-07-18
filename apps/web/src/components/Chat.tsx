"use client";

import { useCallback, useState } from "react";
import { chat } from "@/lib/api";
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
  "Quote AAPL",
  "Research NVDA",
  "What is my buying power?",
  "Propose a limit buy of 1 share of SPY with a short thesis",
  "Hold — no edge today",
];

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

export default function Chat({
  onProposalSubmitted,
  onActivity,
}: {
  onProposalSubmitted?: () => void;
  onActivity?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "system",
      text:
        "Paper research desk. Try a quick action below, or type freely. " +
        "Orders never submit until you confirm in the preflight modal.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<TradeProposal | null>(null);

  const sendText = useCallback(
    async (textRaw: string) => {
      const text = textRaw.trim();
      if (!text || busy) return;
      setInput("");
      setBusy(true);
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
      setMessages((m) => [...m, userMsg]);

      try {
        const res = await chat(text);
        const assistant: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.assistant_text,
          tools: res.tool_results,
          mode: res.mode,
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
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "system",
            text: e instanceof Error ? e.message : "Chat failed",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, onActivity]
  );

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-2xl border border-line bg-panel shadow-lg shadow-black/20">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-white">Agent chat</h2>
            <p className="text-xs text-slate-500">
              Research · propose · confirm · paper only
            </p>
          </div>
          {busy && (
            <span className="animate-pulse rounded-full border border-accent/40 px-2 py-0.5 text-[10px] text-accent">
              thinking…
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => void sendText(q)}
              className="rounded-full border border-line bg-ink/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-accent/50 hover:text-white disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-accent/20 text-slate-100"
                : m.role === "system"
                  ? "border border-line bg-ink/50 text-slate-400"
                  : "bg-ink text-slate-200"
            }`}
          >
            {(m.mode || m.model) && (
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-500">
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
                      className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] ${
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
          <div className="flex gap-1.5 px-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for a quote, research, or a paper proposal…"
            className="flex-1 rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none ring-accent placeholder:text-slate-600 focus:ring-1"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
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
                  text: "Proposal rejected — nothing sent to broker.",
                },
              ]);
            }
          }}
        />
      )}
    </div>
  );
}
