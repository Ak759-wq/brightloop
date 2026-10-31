export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <defs><linearGradient id="bl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5f8bfb" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
        <rect width="32" height="32" rx="9" fill="url(#bl-g)" />
        <path d="M10 21.5a6.5 6.5 0 1 1 6.5 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="16" cy="21.5" r="2.2" fill="#fff" />
      </svg>
      <span className={`text-[17px] font-semibold tracking-tight ${dark ? "text-ink" : "text-white"}`}>Brightloop</span>
    </span>
  );
}
