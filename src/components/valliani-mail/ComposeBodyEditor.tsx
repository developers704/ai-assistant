"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Italic,
  Link2,
  Smile,
  Strikethrough,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isComposeBodyEmpty } from "@/lib/valliani-mail/compose-html";
import { suggestComposeContinuation } from "@/lib/valliani-mail/smart-compose";

const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🥹",
  "😊",
  "😍",
  "🤔",
  "🙌",
  "👍",
  "👏",
  "🔥",
  "✨",
  "✅",
  "❌",
  "❤️",
  "💙",
  "🎉",
  "🙏",
  "😅",
  "😎",
];

function textBeforeCaret(root: HTMLElement): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().replace(/\u00a0/g, " ");
}

function caretAtEnd(root: HTMLElement, before: string): boolean {
  const all = (root.innerText || "").replace(/\u00a0/g, " ").replace(/\n$/, "");
  return before.replace(/\n$/, "") === all;
}

function caretGhostPosition(
  root: HTMLElement,
  container: HTMLElement
): { left: number; top: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  let rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const marker = document.createTextNode("\u200b");
    range.insertNode(marker);
    rect = range.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    // restore caret
    sel.collapse(range.endContainer, range.endOffset);
  }
  const box = container.getBoundingClientRect();
  return {
    left: Math.max(0, rect.left - box.left),
    top: Math.max(0, rect.top - box.top),
  };
}

export function ComposeBodyEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeightClass = "min-h-[180px]",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipSync = useRef(false);
  const dismissedFor = useRef("");
  const [suggestion, setSuggestion] = useState("");
  const [ghostPos, setGhostPos] = useState<{ left: number; top: number } | null>(
    null
  );
  const showPlaceholder = isComposeBodyEmpty(value);

  const refreshSuggestion = useCallback(() => {
    const el = ref.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) {
      setSuggestion("");
      setGhostPos(null);
      return;
    }
    const before = textBeforeCaret(el);
    if (before == null || !caretAtEnd(el, before)) {
      setSuggestion("");
      setGhostPos(null);
      return;
    }
    if (dismissedFor.current === before) {
      setSuggestion("");
      setGhostPos(null);
      return;
    }
    if (dismissedFor.current && before !== dismissedFor.current) {
      dismissedFor.current = "";
    }
    const next = suggestComposeContinuation(before);
    if (!next) {
      setSuggestion("");
      setGhostPos(null);
      return;
    }
    setSuggestion(next);
    setGhostPos(caretGhostPosition(el, wrap));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || skipSync.current) {
      skipSync.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    refreshSuggestion();
  }, [value, refreshSuggestion]);

  function acceptSuggestion() {
    const el = ref.current;
    if (!el || !suggestion) return;
    el.focus();
    document.execCommand("insertText", false, suggestion);
    skipSync.current = true;
    onChange(el.innerHTML);
    setSuggestion("");
    setGhostPos(null);
    dismissedFor.current = "";
  }

  function dismissSuggestion() {
    const el = ref.current;
    if (el) {
      const before = textBeforeCaret(el);
      if (before != null) dismissedFor.current = before;
    }
    setSuggestion("");
    setGhostPos(null);
  }

  return (
    <div ref={wrapRef} className={cn("relative", minHeightClass)}>
      {showPlaceholder ? (
        <div className="pointer-events-none absolute inset-0 text-sm text-white/35 leading-relaxed">
          {placeholder || "Write your message…"}
        </div>
      ) : null}
      {suggestion && ghostPos ? (
        <div
          className="pointer-events-none absolute z-[1] text-sm leading-relaxed text-white/35 whitespace-pre"
          style={{ left: ghostPos.left, top: ghostPos.top }}
          aria-hidden
        >
          {suggestion}
          <span className="ml-1.5 align-middle rounded border border-white/15 bg-white/[0.06] px-1 py-px text-[10px] font-medium tracking-wide text-white/45">
            Tab
          </span>
        </div>
      ) : null}
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline
        aria-label={placeholder || "Message body"}
        aria-autocomplete="inline"
        suppressContentEditableWarning
        className={cn(
          "compose-body-editor relative z-[2] w-full outline-none text-sm text-white leading-relaxed whitespace-pre-wrap break-words",
          "[&_a]:text-sky-300 [&_a]:underline",
          // caret sits above ghost; ghost is behind via absolute sibling
          "bg-transparent",
          minHeightClass,
          className
        )}
        onInput={() => {
          skipSync.current = true;
          dismissedFor.current = "";
          onChange(ref.current?.innerHTML ?? "");
          requestAnimationFrame(refreshSuggestion);
        }}
        onKeyUp={() => requestAnimationFrame(refreshSuggestion)}
        onClick={() => requestAnimationFrame(refreshSuggestion)}
        onKeyDown={(e) => {
          if (!suggestion) return;
          if (e.key === "Tab" || e.key === "ArrowRight") {
            e.preventDefault();
            acceptSuggestion();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            dismissSuggestion();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
    </div>
  );
}

export function ComposeFormatToolbar({
  className,
  leading,
  trailing,
}: {
  className?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);

  function run(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.classList.contains("compose-body-editor")) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function onLink() {
    const raw = window.prompt("Link URL", "https://");
    if (!raw?.trim()) return;
    let href = raw.trim();
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
      href = `https://${href}`;
    }
    run("createLink", href);
  }

  function insertEmoji(emoji: string) {
    run("insertText", emoji);
    setEmojiOpen(false);
  }

  return (
    <div className={cn("flex items-center gap-0.5 flex-wrap", className)}>
      {leading}
      <div className="inline-flex items-center gap-0.5 rounded-xl bg-white/[0.06] ring-1 ring-white/10 px-0.5 py-0.5">
        <ToolBtn label="Bold" onClick={() => run("bold")}>
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn label="Italic" onClick={() => run("italic")}>
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn label="Underline" onClick={() => run("underline")}>
          <Underline size={15} />
        </ToolBtn>
        <ToolBtn label="Strikethrough" onClick={() => run("strikeThrough")}>
          <Strikethrough size={15} />
        </ToolBtn>
        <ToolBtn label="Insert link" onClick={onLink}>
          <Link2 size={15} />
        </ToolBtn>
      </div>
      <div className="relative">
        <ToolBtn
          label="Emoji"
          onClick={() => setEmojiOpen((v) => !v)}
          active={emojiOpen}
        >
          <Smile size={15} />
        </ToolBtn>
        {emojiOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close emoji picker"
              onClick={() => setEmojiOpen(false)}
            />
            <div className="absolute bottom-full left-0 mb-1 z-20 w-[220px] rounded-xl bg-[#1a2230] ring-1 ring-white/12 shadow-xl p-2 grid grid-cols-5 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="h-8 rounded-lg text-base hover:bg-white/10"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => insertEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "p-1.5 rounded-lg text-sky-300/90 hover:bg-white/10 hover:text-sky-200",
        active && "bg-white/10 text-sky-200"
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
