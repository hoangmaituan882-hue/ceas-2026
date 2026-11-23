import type { FeatureItem } from "./atlas-data";

export function AtlasMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.5V21.5M2.5 12H21.5M5.28 5.28L18.72 18.72M18.72 5.28L5.28 18.72"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AtlasLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "atlas-logo atlas-logo--compact" : "atlas-logo"}>
      <AtlasMark size={compact ? 18 : 22} />
      <span className="atlas-wordmark">ātlas.</span>
    </span>
  );
}

export function AppleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 22"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14.94 11.63c-.02-2.25 1.84-3.34 1.92-3.39-1.05-1.53-2.68-1.74-3.26-1.76-1.38-.14-2.71.82-3.41.82-.71 0-1.79-.8-2.95-.78-1.51.02-2.91.88-3.69 2.24-1.58 2.74-.4 6.79 1.13 9.01.75 1.09 1.64 2.31 2.81 2.26 1.13-.04 1.56-.73 2.93-.73 1.37 0 1.75.73 2.94.71 1.22-.02 1.99-1.1 2.73-2.19.86-1.26 1.22-2.48 1.24-2.54-.03-.01-2.37-.91-2.39-3.65zM12.69 4.98c.62-.76 1.04-1.8.93-2.85-.9.04-2 .6-2.64 1.35-.57.66-1.08 1.73-.94 2.75 1 .08 2.02-.5 2.65-1.25z" />
    </svg>
  );
}

export function ChromeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8.6H20.6M9.05 13.7L4.7 6.2M14.95 13.7L10.6 21.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FeatureIcon({ type }: { type: FeatureItem["icon"] }) {
  switch (type) {
    case "collections":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 10.5H21" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 4.5V10.5M14.5 4.5V10.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "local":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8.5 20H15.5M12 16.5V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "browser":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M15.4 8.6L13.5 13.5L8.6 15.4L10.5 10.5L15.4 8.6Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "menubar":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4.5 5.5H19.5M4.5 9.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M12.5 11.5L19 14.3L15.6 15.5L14.4 18.9L12.5 11.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "folders":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3.5 7.5C3.5 6.4 4.4 5.5 5.5 5.5H9.6L11.5 7.5H18.5C19.6 7.5 20.5 8.4 20.5 9.5V16.5C20.5 17.6 19.6 18.5 18.5 18.5H5.5C4.4 18.5 3.5 17.6 3.5 16.5V7.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9.5 13.5H14.5M12.5 11.5L14.5 13.5L12.5 15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "customizable":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12C4.5 16.14 7.86 19.5 12 19.5C15.3 19.5 18 16.8 18 13.5C18 10.9 15.9 8.8 13.3 8.8C11.2 8.8 9.6 10.4 9.6 12.4C9.6 13.9 10.8 15 12.2 15C13.3 15 14.1 14.2 14.1 13.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "native":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="4.5" width="16" height="15" rx="3.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M13.65 12.05c-.01-1.08.88-1.6.92-1.62-.5-.73-1.28-.83-1.56-.84-.66-.07-1.3.39-1.63.39-.34 0-.86-.38-1.41-.37-.72.01-1.4.42-1.77 1.07-.76 1.31-.19 3.25.54 4.32.36.52.78 1.1 1.35 1.08.54-.02.75-.35 1.4-.35.66 0 .84.35 1.41.34.58-.01.95-.53 1.31-1.05.41-.6.58-1.19.59-1.22-.01-.01-1.14-.44-1.15-1.75zM12.57 8.87c.3-.36.5-.86.44-1.37-.43.02-.96.29-1.26.65-.27.31-.52.83-.45 1.32.48.04.97-.24 1.27-.6z"
            fill="currentColor"
          />
        </svg>
      );
    case "fast":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M13.2 3.5L6.5 13.2H12L10.8 20.5L17.5 10.8H12L13.2 3.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "eagle":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5.5 5.5V18.5M10.5 5.5V18.5M14.5 5.5L19 18.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "ios":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="7" y="3.5" width="10" height="17" rx="2.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.8 6.3H13.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "links":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="3.8" ry="8.2" stroke="currentColor" strokeWidth="1.35" transform="rotate(-30 12 12)" />
          <ellipse cx="12" cy="12" rx="3.8" ry="8.2" stroke="currentColor" strokeWidth="1.35" transform="rotate(30 12 12)" />
        </svg>
      );
    case "mcp":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 4.5C12.7 8.4 14.6 10.3 18.5 11C14.6 11.7 12.7 13.6 12 17.5C11.3 13.6 9.4 11.7 5.5 11C9.4 10.3 11.3 8.4 12 4.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="17.8" cy="17.2" r="1.4" fill="currentColor" />
        </svg>
      );
  }
}

export function PlusIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? "atlas-faq-plus atlas-faq-plus--open" : "atlas-faq-plus"}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 3.25V14.75M3.25 9H14.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
