export const SUPABASE_PAGE_SIZE = 1000;

type SupabasePage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function loadAllSupabasePages<T>(
  label: string,
  loadPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const result = await loadPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (result.error) throw new Error(`${label}: ${result.error.message}`);

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) return rows;
  }
}
