import CreateDropForm from "@/components/CreateDropForm";

export default function CreatePage() {
  return (
    <main className="min-h-screen bg-bg grid-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text">Create a Drop</h1>
          <p className="text-muted font-body text-sm mt-2">Distribute SOL or SPL tokens via a shareable link</p>
        </div>
        <CreateDropForm />
      </div>
    </main>
  );
}
