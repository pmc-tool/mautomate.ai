// Lightweight inline SVG icon set. Each accepts a className for sizing/colour.
// Feature icons inherit `currentColor` for the stroke so they can be tinted.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function WebsiteIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M6.5 6.6h.01M9 6.6h.01" />
      <path d="M8 13l-2 2 2 2M12 13l2 2-2 2" />
    </svg>
  );
}

export function MarketingIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 10v4a1 1 0 0 0 1 1h2l6 4V5L6 9H4a1 1 0 0 0-1 1Z" />
      <path d="M16 8.5a4 4 0 0 1 0 7" />
      <path d="M18.5 6a7 7 0 0 1 0 12" />
    </svg>
  );
}

export function SupportIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 16 0v4.5a2.5 2.5 0 0 1-2.5 2.5H14" />
      <rect x="3" y="12" width="3.5" height="6" rx="1.4" />
      <rect x="17.5" y="12" width="3.5" height="6" rx="1.4" />
    </svg>
  );
}

export function OperationsIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M4 20V10M9 20V4M14 20v-7M19 20V8" />
    </svg>
  );
}

export function SocialIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="17" cy="6" r="2.4" />
      <circle cx="17" cy="18" r="2.4" />
      <path d="M8.2 11l6.6-3.6M8.2 13l6.6 3.6" />
    </svg>
  );
}

export function CallIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M6.5 4h2l1.4 3.5-1.7 1.2a11 11 0 0 0 5 5l1.2-1.7L18 16.5v2a2 2 0 0 1-2.2 2A15 15 0 0 1 4 8.2 2 2 0 0 1 6.5 4Z" />
    </svg>
  );
}

export function MicIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </svg>
  );
}

/* ---- Feature-card glyphs (inherit currentColor) ---- */

export function MonitorIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

export function TabletIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function MobileIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function ShopIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M6 8h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function TicketIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
      <path d="M14 6.5v11" strokeDasharray="1.5 2" />
    </svg>
  );
}

export function WatchIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="8" y="7" width="8" height="10" rx="2" />
      <path d="M10 7V4h4v3M10 17v3h4v-3" />
    </svg>
  );
}

export function ShoeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 16c3 0 5-1 7-3l1.5 1.8 4 1.2c2 .3 4.5.5 4.5 2.5V18H3v-2Z" />
      <path d="M10 13l1.6 1.9" />
    </svg>
  );
}

export function ShirtIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M8 4 4 7l2 3 2-1v10h8V9l2 1 2-3-4-3-2.2 2h-3.6L8 4Z" />
    </svg>
  );
}

export function BotIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="4.5" y="8" width="15" height="11" rx="3.5" />
      <path d="M12 4v3M12 3.2h.01" />
      <path d="M9.3 12.5v1.2M14.7 12.5v1.2M10 16.2h4" />
    </svg>
  );
}

export function ChatBubbleIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M20 12a7 6 0 0 1-7 6h-2l-4 3v-4.1A6 6 0 0 1 4 12a7 6 0 0 1 7-6h2a7 6 0 0 1 7 6Z" />
      <path d="M9 11h6M9 14h4" />
    </svg>
  );
}

export function DomainIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.4 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.4-3.7-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  );
}

export function MailIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 5.5L20 7" />
    </svg>
  );
}

export function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRight({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronDown({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function SparkleIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 15 15" className={className} fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.05017 1.20428C6.0711 1.58863 6.09149 1.97298 6.11188 2.35733C6.16291 3.31943 6.21395 4.28154 6.27348 5.24364C6.27477 5.2639 6.27696 5.28389 6.28 5.30359C5.09773 4.23274 4.12283 2.99106 3.36635 1.57412C3.19305 1.25084 2.78979 1.12753 2.46318 1.30083C2.1399 1.47414 2.01656 1.87741 2.18987 2.20403C3.13027 3.9566 4.36915 5.46587 5.90006 6.73824C4.74198 6.90831 3.58383 7.03335 2.42249 7.15874C1.81201 7.22465 1.20065 7.29066 0.587957 7.36335C0.221349 7.40667 -0.03861 7.73663 0.00471639 8.10324C0.0480428 8.46985 0.378021 8.72981 0.744629 8.68648C1.33579 8.61709 1.92597 8.55331 2.5155 8.48959C3.67182 8.36462 4.82565 8.23992 5.97949 8.07373C5.68909 8.75761 5.4316 9.45641 5.17426 10.1548C4.72645 11.3701 4.27912 12.5841 3.65968 13.7159C3.48304 14.0358 3.603 14.4424 3.92628 14.619C4.24956 14.7957 4.65286 14.6757 4.82949 14.3557C5.45152 13.2186 5.90197 11.9996 6.35314 10.7785C6.48673 10.417 6.62038 10.0553 6.75856 9.69554C6.84629 10.6504 6.88248 11.6067 6.89675 12.5927C6.90008 12.9593 7.20337 13.2525 7.56998 13.2492C7.93992 13.2425 8.2332 12.9426 8.22653 12.5726C8.21074 11.4299 8.16573 10.3268 8.05066 9.22129C8.78459 10.1206 9.50563 11.0299 10.1861 11.9692C10.4027 12.2659 10.8194 12.3325 11.1193 12.1159C11.4159 11.8992 11.4826 11.4826 11.2659 11.186C10.402 9.99544 9.47439 8.85201 8.53752 7.71637C8.56168 7.6879 8.58349 7.65733 8.60261 7.62493C10.5168 7.69433 12.4857 7.6754 14.3618 7.59325C14.7285 7.57658 15.015 7.26331 14.9984 6.8967C14.9817 6.5301 14.6684 6.24346 14.3018 6.26013C12.0176 6.36216 9.59359 6.36668 7.30589 6.22553C7.20697 6.10525 7.10822 5.98487 7.00969 5.86433C7.36162 5.82632 7.62597 5.51698 7.60327 5.16032C7.54328 4.19325 7.49192 3.22619 7.44049 2.25788L7.44049 2.25784C7.42049 1.88132 7.40048 1.50461 7.37996 1.12764C7.35996 0.762028 7.04335 0.480405 6.67674 0.501068C6.31013 0.521732 6.02684 0.836677 6.05017 1.20428ZM8.26544 5.07566C9.2181 3.90125 10.1622 2.73737 10.9977 1.4776C11.201 1.17098 11.6176 1.08767 11.9209 1.29097C12.2275 1.49427 12.3142 1.90752 12.1109 2.21414C11.231 3.53726 10.2379 4.7604 9.23803 5.99021C9.00806 6.27683 8.58811 6.32017 8.30149 6.08687C8.01487 5.85691 7.97157 5.43696 8.20486 5.15034L8.26544 5.07566Z"
      />
    </svg>
  );
}

export function SparkIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2c.5 3.9 2.1 5.5 6 6-3.9.5-5.5 2.1-6 6-.5-3.9-2.1-5.5-6-6 3.9-.5 5.5-2.1 6-6Z" />
    </svg>
  );
}

/* ---- Social / platform glyphs (brand-coloured) ---- */

export function FacebookIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M13.2 19v-6h2l.3-2.4h-2.3V9c0-.7.2-1.2 1.2-1.2h1.2V5.6c-.6-.08-1.3-.13-2-.13-2 0-3.4 1.2-3.4 3.5v1.6H8v2.4h2.2V19h3Z"
        fill="#fff"
      />
    </svg>
  );
}

export function InstagramIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 551.034 551.034" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id="igGrad"
          gradientUnits="userSpaceOnUse"
          x1="275.517"
          y1="4.5714"
          x2="275.517"
          y2="549.7202"
          gradientTransform="matrix(1 0 0 -1 0 554)"
        >
          <stop offset="0" stopColor="#E09B3D" />
          <stop offset="0.3" stopColor="#C74C4D" />
          <stop offset="0.6" stopColor="#C21975" />
          <stop offset="1" stopColor="#7024C4" />
        </linearGradient>
      </defs>
      <path
        fill="url(#igGrad)"
        d="M386.878,0H164.156C73.64,0,0,73.64,0,164.156v222.722c0,90.516,73.64,164.156,164.156,164.156h222.722c90.516,0,164.156-73.64,164.156-164.156V164.156C551.033,73.64,477.393,0,386.878,0z M495.6,386.878c0,60.045-48.677,108.722-108.722,108.722H164.156c-60.045,0-108.722-48.677-108.722-108.722V164.156c0-60.046,48.677-108.722,108.722-108.722h222.722c60.045,0,108.722,48.676,108.722,108.722L495.6,386.878L495.6,386.878z"
      />
      <path
        fill="url(#igGrad)"
        d="M275.517,133C196.933,133,133,196.933,133,275.516s63.933,142.517,142.517,142.517S418.034,354.1,418.034,275.516S354.101,133,275.517,133z M275.517,362.6c-48.095,0-87.083-38.988-87.083-87.083s38.989-87.083,87.083-87.083c48.095,0,87.083,38.988,87.083,87.083C362.6,323.611,323.611,362.6,275.517,362.6z"
      />
      <circle fill="url(#igGrad)" cx="418.306" cy="134.072" r="34.149" />
    </svg>
  );
}

export function WhatsappIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        d="M12 6.2a5.7 5.7 0 0 0-4.9 8.6L6.3 18l3.3-.85A5.7 5.7 0 1 0 12 6.2Zm3.3 8c-.14.4-.82.77-1.13.8-.3.03-.57.15-1.9-.4-1.6-.63-2.6-2.25-2.68-2.36-.08-.1-.64-.85-.64-1.62s.4-1.15.55-1.3a.57.57 0 0 1 .42-.2h.3c.1 0 .23-.03.36.27.13.32.46 1.1.5 1.18.04.08.06.17.01.27-.22.45-.46.43-.3.7.55.94 1.1 1.26 1.94 1.68.14.07.23.06.32-.04.1-.1.37-.43.47-.58.1-.14.2-.12.34-.07.14.05.9.42 1.05.5.16.07.26.11.3.18.04.07.04.4-.1.79Z"
        fill="#fff"
      />
    </svg>
  );
}

export function MessengerIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="msg" x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B2FF" />
          <stop offset="1" stopColor="#006AFF" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#msg)" />
      <path
        d="m6 15.4 3.4-3.6 1.9 2 3.3-2-3.4 3.6-1.9-2-3.3 2Z"
        fill="#fff"
      />
    </svg>
  );
}

export function TelegramIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#29A9EB" />
      <path
        fill="#fff"
        d="m5.5 11.9 11-4.24c.5-.18.94.12.78.88l-1.87 8.82c-.13.6-.5.75-1 .47l-2.76-2.03-1.33 1.28c-.15.15-.27.27-.55.27l.2-2.83 5.16-4.66c.22-.2-.05-.31-.35-.12l-6.37 4.02-2.75-.86c-.6-.19-.6-.6.13-.9z"
      />
    </svg>
  );
}

export function XIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.2 10.6 20 4h-1.4l-5 5.7L9.6 4H4.5l6 8.7L4.5 20H6l5.2-6 4.2 6H20l-6.3-9-.5.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ---- Integration / app glyphs (brand-coloured) for the Operations tile ---- */

export function CogIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cogGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#E24913" />
        </linearGradient>
      </defs>
      <path
        fill="url(#cogGrad)"
        d="M19.5 13.05c.04-.34.06-.69.06-1.05s-.02-.71-.06-1.05l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.82-1.05l-.36-2.54a.5.5 0 0 0-.5-.43h-3.84a.5.5 0 0 0-.5.43l-.36 2.54a7.2 7.2 0 0 0-1.82 1.05l-2.39-.96a.5.5 0 0 0-.6.22L2.25 8.74a.5.5 0 0 0 .12.63L4.4 10.95c-.04.34-.06.69-.06 1.05s.02.71.06 1.05l-2.03 1.58a.5.5 0 0 0-.12.63l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.55.42 1.16.78 1.82 1.05l.36 2.54c.04.25.25.43.5.43h3.84c.25 0 .46-.18.5-.43l.36-2.54a7.2 7.2 0 0 0 1.82-1.05l2.39.96c.21.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58Z"
      />
      <circle cx="12" cy="12" r="3.3" fill="#fff" />
    </svg>
  );
}

export function GmailIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M9 39h5V25l-7-5v16.5A2.5 2.5 0 0 0 9.5 39H9Z" />
      <path fill="#34A853" d="M34 39h5.5A2.5 2.5 0 0 0 42 36.5V20l-8 5v14Z" />
      <path fill="#EA4335" d="M34 12v13l8-6v-4.5c0-3.7-4.2-5.8-7.2-3.6L34 12Z" />
      <path fill="#FBBC04" d="M14 25V12l10 7.5L34 12v13l-10 7.5L14 25Z" />
      <path fill="#C5221F" d="M6 14.5V19l8 6V12l-.8-.6C10.2 9.2 6 11.3 6 14.5Z" />
    </svg>
  );
}

export function SlackIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 122.8 122.8" className={className} aria-hidden="true">
      <path fill="#36C5F0" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9Z" />
      <path fill="#2EB67D" d="M32.3 77.6a12.9 12.9 0 0 1 25.8 0v32.3a12.9 12.9 0 0 1-25.8 0V77.6Z" />
      <path fill="#ECB22E" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2Z" />
      <path fill="#E01E5A" d="M45.2 32.3a12.9 12.9 0 0 1 0 25.8H12.9a12.9 12.9 0 0 1 0-25.8h32.3Z" />
      <path fill="#36C5F0" d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2Z" />
      <path fill="#2EB67D" d="M90.5 45.2a12.9 12.9 0 0 1-25.8 0V12.9a12.9 12.9 0 0 1 25.8 0v32.3Z" />
      <path fill="#ECB22E" d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9Z" />
      <path fill="#E01E5A" d="M77.6 90.5a12.9 12.9 0 0 1 0-25.8h32.3a12.9 12.9 0 0 1 0 25.8H77.6Z" />
    </svg>
  );
}

export function GoogleDriveIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden="true">
      <path fill="#0066DA" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" />
      <path fill="#00AC47" d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" />
      <path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.4c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" />
      <path fill="#00832D" d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" />
      <path fill="#2684FC" d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
      <path fill="#FFBA00" d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5z" />
    </svg>
  );
}

export function DropboxIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#0061FF"
        d="M6 2 0 5.85l6 3.85 6-3.85L6 2Zm12 0-6 3.85 6 3.85 6-3.85L18 2ZM0 13.4l6 3.85 6-3.85-6-3.85L0 13.4Zm18-3.85-6 3.85 6 3.85 6-3.85-6-3.85ZM6 18.5l6 3.85 6-3.85-6-3.85-6 3.85Z"
      />
    </svg>
  );
}

export function MicrosoftIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

/* ---- Monochrome social glyphs (inherit currentColor) for the footer chips ---- */

export function FacebookMono({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M13.5 21v-8h2.2l.4-3h-2.6V8.1c0-.87.28-1.46 1.5-1.46l1.6-.01V4.05c-.28-.04-1.24-.12-2.35-.12-2.32 0-3.9 1.42-3.9 4.02V10H8v3h2.35v8h3.15Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function InstagramMono({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16.4" cy="7.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function LinkedinIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 382 382" className={className} aria-hidden="true">
      <path
        fill="#0077B7"
        d="M347.445,0H34.555C15.471,0,0,15.471,0,34.555v312.889C0,366.529,15.471,382,34.555,382h312.889C366.529,382,382,366.529,382,347.444V34.555C382,15.471,366.529,0,347.445,0z M118.207,329.844c0,5.554-4.502,10.056-10.056,10.056H65.345c-5.554,0-10.056-4.502-10.056-10.056V150.403c0-5.554,4.502-10.056,10.056-10.056h42.806c5.554,0,10.056,4.502,10.056,10.056V329.844z M86.748,123.432c-22.459,0-40.666-18.207-40.666-40.666S64.289,42.1,86.748,42.1s40.666,18.207,40.666,40.666S109.208,123.432,86.748,123.432z M341.91,330.654c0,5.106-4.14,9.246-9.246,9.246H286.73c-5.106,0-9.246-4.14-9.246-9.246v-84.168c0-12.556,3.683-55.021-32.813-55.021c-28.309,0-34.051,29.066-35.204,42.11v97.079c0,5.106-4.139,9.246-9.246,9.246h-44.426c-5.106,0-9.246-4.14-9.246-9.246V149.593c0-5.106,4.14-9.246,9.246-9.246h44.426c5.106,0,9.246,4.14,9.246,9.246v15.655c10.497-15.753,26.097-27.912,59.312-27.912c73.552,0,73.131,68.716,73.131,106.472L341.91,330.654L341.91,330.654z"
      />
    </svg>
  );
}

export function LinkedinMono({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M6.5 8.5v10M6.5 5.6v.02M11 18.5v-5.4c0-1.6 2.2-1.8 2.2 0v5.4M11 18.5v-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M16 18.5v-4.6c0-2.9-3.5-2.7-4-.9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
