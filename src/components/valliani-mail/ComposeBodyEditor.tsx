"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const skipSync = useRef(false);
  const showPlaceholder = isComposeBodyEmpty(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || skipSync.current) {
      skipSync.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div className={cn("relative", minHeightClass)}>
      {showPlaceholder ? (
        <div className="pointer-events-none absolute inset-0 text-sm text-white/35 leading-relaxed">
          {placeholder || "Write your message…"}
        </div>
      ) : null}
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline
        aria-label={placeholder || "Message body"}
        suppressContentEditableWarning
        className={cn(
          "compose-body-editor relative w-full outline-none text-sm text-white leading-relaxed whitespace-pre-wrap break-words",
          "[&_a]:text-sky-300 [&_a]:underline",
          minHeightClass,
          className
        )}
        onInput={() => {
          skipSync.current = true;
          onChange(ref.current?.innerHTML ?? "");
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
