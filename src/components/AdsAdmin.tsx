"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAd, saveAd } from "@/app/admin/ads/actions";
import {
  AD_IMAGE_MAX_BYTES,
  AD_PLACEMENTS,
  adImageExtension,
  adScheduleLabel,
  isAdImageType,
  placementLabel,
  type AdminAd,
} from "@/lib/ads";
import { createClient } from "@/lib/supabase/client";

type DraftState = {
  id: string;
  name: string;
  placement: string;
  imageUrl: string;
  clickUrl: string;
  altText: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const emptyDraft: DraftState = {
  id: "",
  name: "",
  placement: "mobile_320x50",
  imageUrl: "",
  clickUrl: "",
  altText: "",
  startsAt: "",
  endsAt: "",
  active: false,
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  if (!value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdsAdmin({
  ads,
  loadError,
}: {
  ads: AdminAd[];
  loadError: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function edit(ad: AdminAd) {
    setError(null);
    setMessage(null);
    setFile(null);
    setFileKey((value) => value + 1);
    setDraft({
      id: ad.id,
      name: ad.name,
      placement: ad.placement,
      imageUrl: ad.imageUrl,
      clickUrl: ad.clickUrl,
      altText: ad.altText,
      startsAt: toDatetimeLocal(ad.startsAt),
      endsAt: toDatetimeLocal(ad.endsAt),
      active: ad.active,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    let imageUrl = draft.imageUrl.trim();
    if (file) {
      if (!isAdImageType(file.type) || !adImageExtension(file.type)) {
        setSaving(false);
        setError("Use a JPEG, PNG, GIF, or WebP image.");
        return;
      }
      if (file.size > AD_IMAGE_MAX_BYTES) {
        setSaving(false);
        setError("That image must be 2 MB or smaller.");
        return;
      }
      const extension = adImageExtension(file.type);
      const path = `${crypto.randomUUID()}.${extension}`;
      const uploaded = await supabase.storage.from("ads").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploaded.error) {
        setSaving(false);
        setError(
          /bucket|not found|schema/i.test(uploaded.error.message)
            ? "The ads image bucket is not ready. Run supabase/migrations/20261022_ads.sql in the Supabase SQL editor."
            : "That image could not be uploaded."
        );
        return;
      }
      imageUrl = supabase.storage.from("ads").getPublicUrl(path).data.publicUrl;
    }

    const result = await saveAd({
      id: draft.id || undefined,
      name: draft.name,
      placement: draft.placement,
      imageUrl,
      clickUrl: draft.clickUrl,
      altText: draft.altText,
      startsAt: fromDatetimeLocal(draft.startsAt),
      endsAt: fromDatetimeLocal(draft.endsAt),
      active: draft.active,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDraft(emptyDraft);
    setFile(null);
    setFileKey((value) => value + 1);
    setMessage(draft.id ? "Ad saved." : "Ad created.");
    router.refresh();
  }

  async function onDelete(ad: AdminAd) {
    if (!window.confirm(`Delete ${ad.name}? The slot falls back to the placeholder.`)) return;
    setDeletingId(ad.id);
    setError(null);
    setMessage(null);
    const result = await deleteAd(ad.id, ad.imageUrl);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (draft.id === ad.id) {
      setDraft(emptyDraft);
      setFile(null);
      setFileKey((value) => value + 1);
    }
    setMessage("Ad deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {loadError ? (
        <p role="alert" className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded border border-[#e0e0e0] bg-white p-4">
          <h2 className="font-semibold">{draft.id ? "Edit ad" : "New ad"}</h2>
          <label className="block">
            <span className="field-label">Name</span>
            <input
              className="field-input"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              maxLength={80}
              required
            />
          </label>
          <label className="block">
            <span className="field-label">Placement</span>
            <select
              className="field-input"
              value={draft.placement}
              onChange={(event) => setDraft({ ...draft, placement: event.target.value })}
            >
              {AD_PLACEMENTS.map((placement) => (
                <option key={placement.id} value={placement.id}>
                  {placement.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Image file</span>
            <input
              key={fileKey}
              className="field-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block">
            <span className="field-label">Image address</span>
            <input
              className="field-input"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={draft.imageUrl}
              onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
            />
            <span className="mt-1 block text-xs text-[#666]">
              Upload a file, or paste an https image link. A file replaces the address.
            </span>
          </label>
          <label className="block">
            <span className="field-label">Click link</span>
            <input
              className="field-input"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={draft.clickUrl}
              onChange={(event) => setDraft({ ...draft, clickUrl: event.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="field-label">Alt text</span>
            <input
              className="field-input"
              value={draft.altText}
              onChange={(event) => setDraft({ ...draft, altText: event.target.value })}
              maxLength={200}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Starts</span>
              <input
                className="field-input"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="field-label">Ends</span>
              <input
                className="field-input"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
              />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-[#1a1a1a]">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              className="h-4 w-4 accent-[#3f679b]"
            />
            Active
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="field-button min-h-11 rounded bg-[#3f679b] px-4 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
            >
              {saving ? "Saving..." : draft.id ? "Save ad" : "Create ad"}
            </button>
            {draft.id ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(emptyDraft);
                  setFile(null);
                  setFileKey((value) => value + 1);
                }}
                className="field-button min-h-11 rounded border border-[#6b6b6b] bg-white px-4 text-sm"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}

      {message ? (
        <p role="status" className="text-sm text-[#2f6b3a]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {ads.length === 0 && !loadError ? (
          <p className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#666]">
            No ads yet. An empty slot shows the dashed placeholder.
          </p>
        ) : null}
        {ads.map((ad) => (
          <article key={ad.id} className="rounded border border-[#e0e0e0] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold">{ad.name}</h2>
                <p className="mt-1 text-sm text-[#3a3a3a]">
                  {placementLabel(ad.placement)} · {adScheduleLabel(ad)}
                </p>
                <p className="mt-1 text-sm text-[#666]">
                  {ad.impressions.toLocaleString()} {ad.impressions === 1 ? "impression" : "impressions"}
                  {" · "}
                  {ad.clicks.toLocaleString()} {ad.clicks === 1 ? "click" : "clicks"}
                </p>
                <p className="mt-1 text-sm text-[#666]">
                  {formatWhen(ad.startsAt)} to {formatWhen(ad.endsAt)}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- advertiser image host is not known ahead of time */}
              <img
                src={ad.imageUrl}
                alt=""
                className="h-12 w-auto max-w-[160px] rounded border border-[#e0e0e0] object-contain"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => edit(ad)}
                className="text-[#3f679b] hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(ad)}
                disabled={deletingId === ad.id}
                className="text-red-700 hover:underline disabled:opacity-60"
              >
                {deletingId === ad.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
