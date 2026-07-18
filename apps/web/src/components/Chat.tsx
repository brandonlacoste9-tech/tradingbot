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
};

export default function Chat({
  onProposalSubmitted,
}: {
  onProposalSubmitted?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "system",
      text:
        "Paper-only agent. Try: “What is my buying power?” then “Propose a limit buy of 1 share of SPY”. Holds: “Hold — no edge today.”",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<TradeProposal | null>(null);

  const send = useCallback(async () => {
    const text = input.trim();
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
      };
      setMessages((m) => [...m, assistant]);

      if (res.proposal && res.proposal.policy_status === "awaiting_confirm") {
        setProposal(res.proposal);
      } else if (res.proposal && res.proposal.policy_status === "policy_rejected") {
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
  }, [busy, input]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold text-white">Agent chat</h2>
        <p className="text-xs text-slate-500">
          Demo keyword path · tool trail visible · orders need preflight confirm
        </p>
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
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.tools && m.tools.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-line/80 pt-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  Tool trail
                </div>
                {m.tools.map((t, i) => (
                  <div
                    key={`${m.id}-${i}`}
                    className="rounded-lg bg-panel/80 px-2 py-1 font-mono text-[11px] text-slate-400"
                  >
                    <span className={t.ok ? "text-good" : "text-bad"}>
                      {t.ok ? "✓" : "✗"}
                    </span>{" "}
                    {t.tool}
                    {t.error ? ` — ${t.error}` : ""}
                    {t.ok && t.result != null ? (
                      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-slate-500">
                        {JSON.stringify(t.result, null, 2).slice(0, 800)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the agent…"
            className="flex-1 rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none ring-accent focus:ring-1"
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
                  text: `Order submitted to Alpaca paper. broker_order_id=${updated.broker_order_id}`,
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
