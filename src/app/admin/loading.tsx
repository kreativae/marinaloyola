// Esqueleto mostrado de imediato ao mudar de página enquanto o servidor responde
export default function AdminLoading() {
  return (
    <div className="animate-page-in" aria-busy="true" aria-label="A carregar">
      <div className="mb-8 space-y-3">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="card mt-6 space-y-4 p-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-1/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
