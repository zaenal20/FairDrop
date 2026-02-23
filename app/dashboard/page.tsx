import DropDashboard from "@/components/DropDashboard";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-bg grid-bg pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text">My Drops</h1>
          <p className="text-muted font-body text-sm mt-1">Drops you've created on-chain</p>
        </div>
        <DropDashboard />
      </div>
    </main>
  );
}
