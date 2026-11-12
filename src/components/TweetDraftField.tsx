"use client";

import { useState } from "react";
import { saveDigestTweetDraft } from "@/app/admin/review/actions";
import { cleanTweetDraft, TWEET_LIMIT, xIntentUrl, xPostLength } from "@/lib/tweet";

export default function TweetDraftField({
  storyId,
  initialText,
}: {
  storyId: string;
  initialText: string;
}) {
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(initialText);
  const [serverText, setServerText] = useState(initialText);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error">("ok");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (serverText !== initialText) {
    setServerText(initialText);
    if (text === serverText) {
      setText(initialText);
      setSaved(initialText);
    }
  }

  const count = xPostLength(text);
  const over = count > TWEET_LIMIT;
  const countId = `tweet-count-${storyId}`;

  async function onBlur() {
    const cleaned = cleanTweetDraft(text);
    if (!cleaned.ok) {
      setStatus(cleaned.error);
      setStatusTone("error");
      return;
    }

    const next = cleaned.value ?? "";
    if (next !== text) setText(next);
    if (next === saved) return;

    setSaving(true);
    setStatus(null);
    try {
      const result = await saveDigestTweetDraft(storyId, next);
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setSaved(next);
      setStatus("Saved");
      setStatusTone("ok");
    } catch {
      setStatus("That could not be saved.");
      setStatusTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setStatus("Could not copy.");
      setStatusTone("error");
    }
  }

  return (
    <div className="mt-3">
      <label htmlFor={`tweet-${storyId}`} className="field-label text-base">
        Tweet
      </label>
      <textarea
        id={`tweet-${storyId}`}
        value={text}
        rows={3}
        aria-describedby={countId}
        onChange={(event) => {
          setText(event.target.value);
          setCopied(false);
        }}
        onBlur={() => {
          void onBlur();
        }}
        className="field-input text-base leading-relaxed"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span id={countId} className={`text-sm ${over ? "text-red-700" : "text-[#3a3a3a]"}`}>
          {count}/{TWEET_LIMIT}
        </span>
        <button
          type="button"
          onClick={() => {
            void onCopy();
          }}
          className="field-button min-h-11 w-full rounded border border-[#c8c8c8] bg-white px-4 text-base font-medium text-[#1a1a1a] sm:w-auto"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={xIntentUrl(text)}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 w-full items-center justify-center rounded bg-[#3f679b] px-4 text-base font-medium text-white hover:bg-[#345580] sm:w-auto"
        >
          Post on X
        </a>
        {saving ? <span className="text-sm text-[#3a3a3a]">Saving...</span> : null}
        {status ? (
          <span
            role={statusTone === "error" ? "alert" : "status"}
            className={`text-sm ${statusTone === "error" ? "text-red-700" : "text-[#2f6b3a]"}`}
          >
            {status}
          </span>
        ) : null}
      </div>
    </div>
  );
}
