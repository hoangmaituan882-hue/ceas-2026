export function PointerCursorIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4.2 2.8L14.1 8.4L9.4 9.9L7.6 14.7L4.2 2.8Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HandPanIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M6.4 9.4V4.5C6.4 3.9 6.9 3.4 7.5 3.4C8.1 3.4 8.6 3.9 8.6 4.5V8.3M8.6 7.8V3.6C8.6 3 9.1 2.5 9.7 2.5C10.3 2.5 10.8 3 10.8 3.6V8.2M10.8 7.9V4.7C10.8 4.1 11.3 3.6 11.9 3.6C12.5 3.6 13 4.1 13 4.7V9.4M13 8.8V6.4C13 5.8 13.5 5.4 14.1 5.4C14.7 5.4 15.1 5.8 15.1 6.4V10.4C15.1 13.3 13 15.5 10.1 15.5H8.8C6.6 15.5 5 14.2 4.1 12.2L2.9 9.5C2.6 8.9 2.9 8.1 3.6 7.9C4.2 7.7 4.9 8 5.2 8.6L6.4 10.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ImageAddIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.6" y="3.2" width="12.8" height="11.6" rx="2.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6.5" cy="7" r="1.15" fill="currentColor" />
      <path
        d="M3.4 13L7.2 9.4L10 12L12.1 10.1L14.8 12.8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MosaicGridIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.6" y="3" width="12.8" height="12" rx="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 7.5H15.2M2.8 11.4H15.2M7.5 3.2V14.8M11.4 3.2V14.8" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function EditPencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M12.2 3.1L14.9 5.8L6.5 14.2L3.2 14.8L3.8 11.5L12.2 3.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CommentPlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M14.8 9.1C14.8 5.8 12.2 3.2 9 3.2C5.8 3.2 3.2 5.8 3.2 9C3.2 10.3 3.6 11.5 4.4 12.5L3.6 14.9L6.1 14.1C7 14.5 8 14.8 9 14.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 11.2V15.4M10.9 13.3H15.1" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

export function CommentBubbleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M14.8 9C14.8 12.2 12.2 14.8 9 14.8C8 14.8 7 14.5 6.1 14.1L3.6 14.9L4.4 12.5C3.6 11.5 3.2 10.3 3.2 9C3.2 5.8 5.8 3.2 9 3.2C12.2 3.2 14.8 5.8 14.8 9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReplyArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7.6 5.2L3.6 9L7.6 12.8M4.2 9H10.8C12.9 9 14.4 10.3 14.4 12.4V13.4"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ZoomInGlassIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4.9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.6 11.6L15 15" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M8 5.9V10.1M5.9 8H10.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function ZoomOutGlassIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4.9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.6 11.6L15 15" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M5.9 8H10.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function FitExpandIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11.4 3.4H14.6V6.6M14.4 3.6L10.3 7.7M6.6 14.6H3.4V11.4M3.6 14.4L7.7 10.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowUpSendIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 12.6V3.6M4.2 7.2L8 3.4L11.8 7.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronUpIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.2 10L8 6.2L11.8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.2 6.2L8 10L11.8 6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseCrossIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.3 4.3L11.7 11.7M11.7 4.3L4.3 11.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SmilePlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M14.7 9.4C14.5 12.5 12 14.9 8.9 14.9C5.6 14.9 3 12.3 3 9C3 5.7 5.6 3.1 8.9 3.1C9.5 3.1 10.1 3.2 10.6 3.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="7" cy="8.2" r="0.8" fill="currentColor" />
      <circle cx="10.8" cy="8.2" r="0.8" fill="currentColor" />
      <path d="M6.8 10.8C7.4 11.6 8.1 12 8.9 12C9.7 12 10.4 11.6 11 10.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M13.6 3V6.6M11.8 4.8H15.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TextSizeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.6 6.2H8.4M5.5 6.2V13.8M9.4 4.2H15.6M12.5 4.2V13.8"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CodeBracesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M6.8 3.6C5.6 3.6 5.2 4.3 5.2 5.4V7.1C5.2 8.1 4.6 8.8 3.6 9C4.6 9.2 5.2 9.9 5.2 10.9V12.6C5.2 13.7 5.6 14.4 6.8 14.4M11.2 3.6C12.4 3.6 12.8 4.3 12.8 5.4V7.1C12.8 8.1 13.4 8.8 14.4 9C13.4 9.2 12.8 9.9 12.8 10.9V12.6C12.8 13.7 12.4 14.4 11.2 14.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PaletteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 3C5.6 3 3 5.6 3 9C3 12.4 5.7 15 9 15C10.1 15 10.9 14.2 10.9 13.2C10.9 12.7 10.7 12.3 10.4 12C10.1 11.7 10 11.3 10.1 10.9C10.3 10.4 10.8 10.1 11.3 10.1H12.4C13.9 10.1 15 9 15 7.5C15 5 12.3 3 9 3Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="6.2" cy="8.1" r="0.85" fill="currentColor" />
      <circle cx="8.3" cy="6" r="0.85" fill="currentColor" />
      <circle cx="11.3" cy="6.6" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function BulletListIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="3.8" cy="5.2" r="0.9" fill="currentColor" />
      <circle cx="3.8" cy="9" r="0.9" fill="currentColor" />
      <circle cx="3.8" cy="12.8" r="0.9" fill="currentColor" />
      <path d="M6.8 5.2H14.6M6.8 9H14.6M6.8 12.8H14.6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

export function CheckResolveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.4 8.4L6.4 11.4L12.6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
