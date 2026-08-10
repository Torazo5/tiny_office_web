"use client";

import { Input } from "@/components/ui/input";
import { trackEvent } from "@/components/analytics";

export function SearchForm({ searchQuery }: { searchQuery: string }) {
  return (
    <form
      action="/"
      method="get"
      className="order-2 min-w-0 basis-full lg:order-none lg:flex-1 lg:basis-auto lg:max-w-[420px]"
      onSubmit={(event) => {
        const query = new FormData(event.currentTarget).get("q");
        trackEvent({
          eventName: "search_submitted",
          source: "header_search",
          queryLength: typeof query === "string" ? query.trim().length : 0,
        });
      }}
    >
      <Input
        type="search"
        name="q"
        defaultValue={searchQuery}
        placeholder="Search performances, artists, songs"
        className="bg-secondary"
        aria-label="Search performances, artists, and songs"
      />
    </form>
  );
}
