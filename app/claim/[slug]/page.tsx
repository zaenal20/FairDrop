import { notFound } from "next/navigation";
import { resolveSlug } from "@/lib/db";
import ClaimDropCard from "@/components/ClaimDropCard";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const dropAddress = await resolveSlug(slug);
  if (!dropAddress) notFound();

  return (
    <main className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <ClaimDropCard dropAddress={dropAddress} slug={slug} />
      </div>
    </main>
  );
}
