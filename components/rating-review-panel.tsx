"use client";

import Link from "next/link";
import { useState } from "react";
import { saveRating, saveReview } from "@/app/ratings/actions";
import { StarPicker } from "@/components/star-picker";

export function RatingReviewPanel({
  videoId,
  isSignedIn,
  initialRating,
  initialReview,
}: {
  videoId: string;
  isSignedIn: boolean;
  initialRating: number | null;
  initialReview: { rating: number; text: string } | null;
}) {
  const [rating, setRating] = useState(initialReview?.rating ?? initialRating);
  const [reviewText, setReviewText] = useState(initialReview?.text ?? "");
  const [isWriting, setIsWriting] = useState(Boolean(initialReview));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRating(nextRating: number) {
    if (!isSignedIn) return;
    const previousRating = rating;
    setRating(nextRating);
    setMessage(null);
    setIsSaving(true);
    const result = await saveRating(videoId, nextRating);
    if (result?.error) {
      setRating(previousRating);
      setMessage(result.error);
    } else {
      setMessage(result?.success ?? "Rating saved.");
    }
    setIsSaving(false);
  }

  async function handleReviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) {
      setMessage("Choose a star rating before saving your review.");
      return;
    }

    setMessage(null);
    setIsSaving(true);
    const result = await saveReview({
      performanceVideoId: videoId,
      rating,
      text: reviewText,
    });
    setMessage(result?.error ?? result?.success ?? null);
    setIsSaving(false);
    if (!result?.error) setIsWriting(false);
  }

  return (
    <div className="flex flex-col gap-3 border-y border-border py-4 mb-4">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span className="text-[12.5px] font-medium text-muted-foreground">Your rating</span>
        {isSignedIn ? (
          <StarPicker value={rating} onChange={(value) => void handleRating(value)} disabled={isSaving} />
        ) : (
          <Link
            href={{ pathname: "/login", query: { next: `/video/${videoId}` } }}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            Sign in to rate
          </Link>
        )}
        <div className="flex-1" />
        {isSignedIn ? (
          <button
            type="button"
            onClick={() => {
              setIsWriting((open) => !open);
              setMessage(null);
            }}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            {isWriting ? "Close review" : initialReview ? "Edit review" : "Write a review"}
          </button>
        ) : (
          <Link
            href={{ pathname: "/login", query: { next: `/video/${videoId}` } }}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            Write a review
          </Link>
        )}
      </div>

      {isWriting && isSignedIn && (
        <form onSubmit={(event) => void handleReviewSubmit(event)} className="flex flex-col gap-2">
          <label htmlFor={`review-${videoId}`} className="sr-only">Your review</label>
          <textarea
            id={`review-${videoId}`}
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="What did you think of this set?"
            className="w-full resize-y rounded-lg border border-input bg-secondary px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">{reviewText.length}/5000</span>
            <button
              type="submit"
              disabled={isSaving || !reviewText.trim() || !rating}
              className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving…" : initialReview ? "Update review" : "Publish review"}
            </button>
          </div>
        </form>
      )}

      {message && <p className="text-[12px] text-muted-foreground">{message}</p>}
    </div>
  );
}
