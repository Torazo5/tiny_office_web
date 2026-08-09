"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleReviewLike } from "@/app/review-likes/actions";

export function ReviewLikeButton({
  reviewId,
  videoId,
  initialLikeCount = 0,
  initialLiked = false,
  isSignedIn,
}: {
  reviewId?: string;
  videoId: string;
  initialLikeCount?: number;
  initialLiked?: boolean;
  isSignedIn: boolean;
}) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!reviewId) return null;
  const validReviewId = reviewId;

  function handleToggle() {
    const nextLiked = !liked;
    setError(null);
    startTransition(async () => {
      const result = await toggleReviewLike(validReviewId, nextLiked);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setLiked(result?.liked ?? nextLiked);
      setLikeCount(result?.likeCount ?? likeCount);
    });
  }

  if (!isSignedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: `/video/${videoId}` } }}
        title="Sign in to like this review"
        className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground transition-colors hover:text-primary"
      >
        <span aria-hidden className="text-[15px] leading-none">♡</span>
        <span>{likeCount}</span>
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={liked}
        aria-label={liked ? "Remove your like" : "Like this review"}
        title={liked ? "Remove your like" : "Like this review"}
        className={`inline-flex items-center gap-1.5 text-[11.5px] transition-colors disabled:cursor-wait disabled:opacity-60 ${
          liked ? "text-primary" : "text-muted-foreground hover:text-primary"
        }`}
      >
        <span aria-hidden className="text-[15px] leading-none">{liked ? "♥" : "♡"}</span>
        <span>{likeCount}</span>
      </button>
      {error && <span className="text-[11px] text-primary">{error}</span>}
    </span>
  );
}
