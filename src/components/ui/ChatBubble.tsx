"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage, PendingAction } from "@/types";
import { Button } from "./Button";
import { Bot, User, Check, X, Mic, MicOff } from "lucide-react";
import { useSpeech } from "@/lib/hooks/useSpeech";

interface ChatBubbleProps {
  message: ChatMessage;
  onConfirm?: () => void;
  onReject?: () => void;
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    let content = line;
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    if (line.startsWith("• ") || line.startsWith("- ")) {
      content = `<span class="block pl-2">${content}</span>`;
    }
    return (
      <span
        key={i}
        className="block"
        dangerouslySetInnerHTML={{ __html: content || "&nbsp;" }}
      />
    );
  });
}

function PendingActionCard({
  action,
  onConfirm,
  onReject,
}: {
  action: PendingAction;
  onConfirm?: () => void;
  onReject?: () => void;
}) {
  return (
    <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <p className="text-sm font-medium text-amber-800 mb-2">⚠️ Confirmation Required</p>
      <p className="text-sm text-amber-900 mb-1 font-medium">{action.title}</p>
      <p className="text-sm text-amber-800 whitespace-pre-wrap mb-3">{action.preview}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700">
          <Check size={14} /> Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <X size={14} /> Cancel
        </Button>
      </div>
    </div>
  );
}

export function ChatBubble({ message, onConfirm, onReject }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/30">
            <User size={16} className="text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-glow">
            <Bot size={16} className="text-white" />
          </div>
        )}
      </div>
      <div className={cn("max-w-[80%] space-y-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "btn-futuristic text-white rounded-tr-md shadow-elevated"
              : "glass-panel-strong text-ink rounded-tl-md"
          )}
        >
          {renderMarkdown(message.content)}
        </div>
        {!isUser && message.pendingAction && (
          <PendingActionCard
            action={message.pendingAction}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}
        <p className="text-xs text-ink-muted px-1">
          {new Date(message.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Ask your assistant anything...",
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const { listening, supported, toggleListening } = useSpeech((text) => {
    setValue((prev) => (prev ? `${prev} ${text}` : text));
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={listening ? "Listening..." : placeholder}
          disabled={disabled}
          className="w-full pl-4 pr-12 py-3 rounded-2xl border border-white/25 bg-white/10 text-sm text-ink backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-accent-purple/40 focus:border-accent-purple/50 disabled:opacity-50 placeholder:text-ink-muted"
        />
        {supported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              listening
                ? "bg-accent-rose text-white animate-pulse"
                : "text-ink-muted hover:text-white hover:bg-white/10"
            )}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
      </div>
      <Button type="submit" disabled={disabled || !value.trim()}>
        Send
      </Button>
    </form>
  );
}
