"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import HoneypotField from "@/components/HoneypotField";
import { prepareResumeUpload, submitJobApplication } from "@/app/jobs/actions";
import {
  HONEYPOT_FIELD,
  RESUME_BUCKET,
  RESUME_FILE_ERROR,
  RESUME_MAX_BYTES,
  RESUME_MIME,
  US_STATES,
  resumeKindFromName,
} from "@/lib/form-fields";
import { createClient } from "@/lib/supabase/client";

export default function JobApplicationForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [resumePath, setResumePath] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const honeypot = String(data.get(HONEYPOT_FIELD) ?? "");
    const fileInput = form.elements.namedItem("resume");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;

    if (!file && !resumePath) {
      setError(RESUME_FILE_ERROR);
      return;
    }

    setPending(true);

    try {
      let path = resumePath;
      if (file && !path) {
        const kind = resumeKindFromName(file.name);
        if (!kind || file.size <= 0 || file.size > RESUME_MAX_BYTES) {
          setError(RESUME_FILE_ERROR);
          setPending(false);
          return;
        }

        const ticket = await prepareResumeUpload({
          fileName: file.name,
          fileSize: file.size,
          honeypot,
        });

        if (!ticket.ok) {
          setError(ticket.error);
          setPending(false);
          return;
        }

        if (ticket.skipped) {
          setDone(true);
          setPending(false);
          return;
        }

        const typedFile = new File([file], file.name, { type: RESUME_MIME[kind] });
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(RESUME_BUCKET)
          .uploadToSignedUrl(ticket.path, ticket.token, typedFile, {
            contentType: RESUME_MIME[kind],
          });

        if (uploadError) {
          setError("The resume could not be uploaded. Check the file and try again.");
          setPending(false);
          return;
        }

        path = ticket.path;
        setResumePath(path);
      }

      data.set("resumePath", path);
      data.delete("resume");
      const result = await submitJobApplication(data);
      if (!result.ok) {
        const message = result.error ?? "Something went wrong. Please try again.";
        if (/resume|PDF|expired/i.test(message)) setResumePath("");
        setError(message);
        return;
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8 rounded border border-[#e0e0e0] bg-white p-5">
      <h2 className="text-lg font-semibold">Apply</h2>
      <p className="mb-4 mt-1 text-sm text-[#666]">
        Tell us about the role you want. A resume is required.
      </p>

      {done ? (
        <p
          role="status"
          className="rounded border border-[#2f6b3a] bg-white p-4 text-[15px] leading-relaxed text-[#1a1a1a]"
        >
          Thanks. We received your application and will be in touch at the email address you
          entered if it is a fit.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="relative space-y-3">
          <HoneypotField />
          <div>
            <label htmlFor="job-name" className="field-label">
              Full name
            </label>
            <input
              id="job-name"
              name="fullName"
              type="text"
              required
              maxLength={200}
              autoComplete="name"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-email" className="field-label">
              Email
            </label>
            <input
              id="job-email"
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-phone" className="field-label">
              Phone
            </label>
            <input
              id="job-phone"
              name="phone"
              type="tel"
              required
              maxLength={30}
              autoComplete="tel"
              className="field-input"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="job-city" className="field-label">
                City
              </label>
              <input
                id="job-city"
                name="city"
                type="text"
                required
                maxLength={80}
                autoComplete="address-level2"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="job-state" className="field-label">
                State
              </label>
              <select
                id="job-state"
                name="state"
                required
                defaultValue=""
                autoComplete="address-level1"
                className="field-input"
              >
                <option value="" disabled>
                  Select a state
                </option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="job-position" className="field-label">
              Position applying for
            </label>
            <input
              id="job-position"
              name="position"
              type="text"
              required
              maxLength={200}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-website" className="field-label">
              Portfolio, LinkedIn, or website <span className="text-[#5c5c5c]">(optional)</span>
            </label>
            <input
              id="job-website"
              name="website"
              type="url"
              maxLength={500}
              placeholder="https://"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-resume" className="field-label">
              Resume
            </label>
            <input
              id="job-resume"
              name="resume"
              type="file"
              required={!resumePath}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-describedby="job-resume-hint"
              className="field-input file:mr-3 file:border-0 file:bg-transparent file:text-[15px] file:font-medium file:text-[#3f679b]"
              onChange={() => setResumePath("")}
            />
            <p id="job-resume-hint" className="mt-1 text-[12px] text-[#666]">
              PDF, DOC, or DOCX. Maximum 5 MB.
            </p>
          </div>
          <div>
            <label htmlFor="job-cover" className="field-label">
              Cover letter or message
            </label>
            <textarea
              id="job-cover"
              name="coverLetter"
              required
              rows={6}
              maxLength={5000}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-heard" className="field-label">
              How did you hear about us? <span className="text-[#5c5c5c]">(optional)</span>
            </label>
            <input id="job-heard" name="heardAbout" type="text" maxLength={200} className="field-input" />
          </div>
          <label className="flex items-start gap-2 text-sm leading-relaxed text-[#1a1a1a]">
            <input name="consent" type="checkbox" required className="mt-1 h-4 w-4 accent-[#3f679b]" />
            <span>
              I agree that Cornhole Media may store this application, including my resume, and use
              it to review my application and contact me about this role. See the{" "}
              <Link href="/privacy" className="text-[#3f679b] underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded border border-red-700 bg-white p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="field-button rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {pending ? "Sending..." : "Submit application"}
          </button>
        </form>
      )}
    </section>
  );
}
