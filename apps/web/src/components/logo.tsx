export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="text-2xl leading-none text-brand-orange" aria-hidden>
        ♚
      </span>
      <span className="leading-tight">
        <span className="text-brand-orange">Kingdom</span> <span className="text-primary">of Chess</span>
      </span>
    </span>
  );
}
