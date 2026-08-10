import Link from "next/link";
import { Header } from "@/components/header";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <>
      <Header showBack={false} user={null} />
      <main className="mx-auto w-full max-w-[520px] p-4 sm:p-8">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Use Google or an email and password to revise timelines, rate performances, write reviews, and save playlists.
        </p>
        {error && <p className="mb-4 text-sm text-primary">{error}</p>}
        <LoginForm nextPath={next} />
        <Link href="/" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground">
          Back to browse
        </Link>
      </main>
    </>
  );
}
