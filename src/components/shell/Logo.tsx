/** Brightloop mark: a "B" whose lower bowl loops back into a renewal arrow – recurring revenue. */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  const uid = "m"; // identical defs, so repeated ids are harmless
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={`blg-${uid}`} x1="3" y1="1" x2="29" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f7bff" /><stop offset=".5" stopColor="#1f4ae8" /><stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <radialGradient id={`blh-${uid}`} cx="8" cy="5" r="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#blg-${uid})`} />
      <rect width="32" height="32" rx="9" fill={`url(#blh-${uid})`} />
      <path d="M10.5 19.2V8h5.6a3.9 3.9 0 0 1 0 7.8h-5.6 7a4.1 4.1 0 0 1 0 8.2h-5.2" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 21.4l-2.6 2.6 2.6 2.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.8" cy="8.4" r="1.8" fill="#67e8f9" />
    </svg>
  );
}

export function Logo({ dark = false, size = 30 }: { dark?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`text-[17px] font-semibold tracking-tight ${dark ? "text-ink" : "text-white"}`}>Brightloop</span>
    </span>
  );
}
