"use client";

import Image from "next/image";
import { useState } from "react";
import { PlaceholderThumb } from "@/components/placeholder-thumb";
import { cn } from "@/lib/utils";

const YOUTUBE_THUMBNAIL_URL = "https://i.ytimg.com/vi/{videoId}/hqdefault.jpg";

export function YouTubeThumbnail({
  videoId,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
}: {
  videoId?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = videoId
    ? YOUTUBE_THUMBNAIL_URL.replace("{videoId}", encodeURIComponent(videoId))
    : null;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {imageUrl && !hasError ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          onError={() => setHasError(true)}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <PlaceholderThumb label="NO IMAGE" className="h-full w-full" />
      )}
    </div>
  );
}
