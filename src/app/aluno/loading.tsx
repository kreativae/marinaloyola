export default function AlunoLoading() {
  return (
    <div className="animate-page-in" aria-busy="true" aria-label="A carregar">
      <div className="skeleton mb-3 h-9 w-64" />
      <div className="skeleton mb-8 h-4 w-80 max-w-full" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="skeleton h-36 w-full" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
