// CC0 SVG sources from SVG Repo:
// https://www.svgrepo.com/svg/343042/clipboard-check
// https://www.svgrepo.com/svg/343352/warning-triangle
// https://www.svgrepo.com/svg/343260/refresh-alt
// https://www.svgrepo.com/svg/371372/lightbulb

export function VerificationIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(4 3)"
      >
        <path d="m3.5 1.5h-2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1h-2" />
        <path d="m4.5.5h4a1 1 0 0 1 0 2h-4a1 1 0 0 1 0-2Z" />
        <path d="m3.5 8.5 2 2 5-5" />
      </g>
    </svg>
  );
}

export function LowStockIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
    >
      <g transform="translate(1 1)">
        <path
          d="m9.5.5 9 16h-18Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m9.5 10.5v-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="9.5" cy="13.5" r="1" fill="currentColor" />
      </g>
    </svg>
  );
}

export function StockUpdateIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(2 1)"
      >
        <path d="m1.5 5.5c1.38-2.41 4.02-4 7-4 4.42 0 8 3.58 8 8" />
        <path d="m15.5 13.5c-1.41 2.29-4.12 4-7 4-4.42 0-8-3.58-8-8" />
        <path d="m6.5 5.5h-5v-5" />
        <path d="m10.5 13.5h5v5" />
      </g>
    </svg>
  );
}

export function InventoryTip({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0a5 5 0 0 0-2.82 9L6 11a.5.5 0 0 0 0 1 .5.5 0 0 0 0 1 .5.5 0 0 0 0 1 .5.5 0 0 0 0 1h.41c.34.55.92.93 1.58 1 .68-.07 1.26-.45 1.6-.99L10 15a.5.5 0 0 0 0-1 .5.5 0 0 0 0-1 .5.5 0 0 0 0-1 .5.5 0 0 0 0-1l.8-2A5 5 0 0 0 8 0Zm2.25 8.21-.25.17-.11.29L9 10.81a.3.3 0 0 1-.27.19H7.22a.29.29 0 0 1-.22-.19l-.87-2.14L6 8.38l-.25-.18A3.88 3.88 0 0 1 4 5a4 4 0 0 1 8 0 3.9 3.9 0 0 1-1.75 3.21Z" />
      <path d="M10.29 3A3.14 3.14 0 0 0 8 2v1c.59 0 1.12.24 1.5.62.28.39.46.86.5 1.37l1 .01a3.2 3.2 0 0 0-.72-2Z" />
    </svg>
  );
}
