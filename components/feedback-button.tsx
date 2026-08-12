"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { X } from "lucide-react";
import { submitFeedback } from "@/app/feedback/actions";

export function FeedbackButton() {
  const pathname = usePathname() ?? "/";
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openFeedback() {
    setNotice(null);
    setIsSubmitted(false);
    setMessage("");
    setIsOpen(true);
  }

  function closeFeedback() {
    if (isSaving || isTransitionPending) return;
    setIsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setNotice(null);
    setIsSaving(true);

    startTransition(() => {
      void submitFeedback(formData)
        .then((result) => {
          if (result?.error) {
            setNotice(result.error);
            return;
          }
          setIsSubmitted(true);
          setMessage("");
        })
        .catch(() => {
          setNotice("Could not save your feedback. Please try again.");
        })
        .finally(() => setIsSaving(false));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openFeedback}
        className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-haspopup="dialog"
      >
        Feedback
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeFeedback();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">TinyOffice feedback</p>
                <h2 id="feedback-dialog-title" className="mt-2 text-[19px] font-semibold text-foreground">
                  Facing an issue or want to give feedback?
                </h2>
              </div>
              <button
                type="button"
                onClick={closeFeedback}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close feedback dialog"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            {isSubmitted ? (
              <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-4">
                <p className="text-[14px] font-medium text-foreground">Thanks — your feedback is saved.</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  I&apos;ll check it from the admin dashboard every few days.
                </p>
                <button
                  type="button"
                  onClick={closeFeedback}
                  className="mt-4 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Tell me what happened, what felt confusing, or what you&apos;d love to see next. No sign-in required.
                </p>
                <label htmlFor="feedback-message" className="sr-only">Your feedback</label>
                <textarea
                  id="feedback-message"
                  name="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  rows={7}
                  required
                  placeholder="What should I know?"
                  className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-ring/30"
                />
                <input type="hidden" name="source_path" value={pathname} />
                <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="feedback-website">Website</label>
                  <input id="feedback-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-muted-foreground">{message.length}/5000</span>
                  <button
                    type="submit"
                    disabled={isSaving || isTransitionPending || !message.trim()}
                    className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Sending…" : "Send feedback"}
                  </button>
                </div>
                {notice && <p className="text-[12px] text-primary" role="alert">{notice}</p>}
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
