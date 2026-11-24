export function SidebarToggleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 3.2V14.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function AllGridIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.35" />
      <rect x="9.2" y="2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.35" />
      <rect x="2" y="9.2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.35" />
      <rect x="9.2" y="9.2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function InboxIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 9.2L4.2 3.2H11.8L13.5 9.2V12.5C13.5 13.1 13.1 13.5 12.5 13.5H3.5C2.9 13.5 2.5 13.1 2.5 12.5V9.2Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M2.6 9.2H5.8L6.6 10.8H9.4L10.2 9.2H13.4" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  );
}

export function HeartIcon({ size = 15, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="M8 13.4C8 13.4 2.3 9.9 2.3 5.7C2.3 3.9 3.6 2.6 5.3 2.6C6.4 2.6 7.4 3.2 8 4.1C8.6 3.2 9.6 2.6 10.7 2.6C12.4 2.6 13.7 3.9 13.7 5.7C13.7 9.9 8 13.4 8 13.4Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.7 9.3L9.3 6.7M6 11.4L4.7 12.7C3.7 13.7 2.2 12.2 3.2 11.2L4.5 9.9M10 4.6L11.3 3.3C12.3 2.3 13.8 3.8 12.8 4.8L11.5 6.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function FolderIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4.3C2 3.6 2.6 3 3.3 3H6.2L7.5 4.4H12.7C13.4 4.4 14 5 14 5.7V11.7C14 12.4 13.4 13 12.7 13H3.3C2.6 13 2 12.4 2 11.7V4.3Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  );
}

export function HashTagIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.2 2.8L4.8 13.2M11.2 2.8L9.8 13.2M3 6H13.2M2.5 10H12.7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.3H13M6 4.3V3.2C6 2.8 6.3 2.5 6.7 2.5H9.3C9.7 2.5 10 2.8 10 3.2V4.3M4.4 4.3L5 12.6C5 13.1 5.4 13.5 5.9 13.5H10.1C10.6 13.5 11 13.1 11 12.6L11.6 4.3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7.2" cy="7.2" r="4.7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.7 10.7L13.8 13.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SunMoonIcon({ dark, size = 15 }: { dark: boolean; size?: number }) {
  return dark ? (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.8V3.1M8 12.9V14.2M1.8 8H3.1M12.9 8H14.2M3.6 3.6L4.5 4.5M11.5 11.5L12.4 12.4M12.4 3.6L11.5 4.5M4.5 11.5L3.6 12.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M12.9 9.7A5.4 5.4 0 0 1 6.3 3.1a5.5 5.5 0 1 0 6.6 6.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.2V12.8M3.2 8H12.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon({ open, size = 12 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 160ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SlidersIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="5.5" cy="4.5" r="1.4" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1.4" fill="currentColor" />
      <circle cx="6.8" cy="11.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function JustifiedIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="7" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.5" y="2.5" width="3.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="4.2" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.8" y="9" width="6.2" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function SquareGridIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="6.4" y="2" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="10.8" y="2" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2" y="6.4" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="6.4" y="6.4" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="10.8" y="6.4" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2" y="10.8" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="6.4" y="10.8" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
      <rect x="10.8" y="10.8" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function FitAspectIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="3.5" width="11.6" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <rect x="4.5" y="5.5" width="7" height="5" rx="0.8" fill="currentColor" fillOpacity="0.22" />
    </svg>
  );
}

export function InfoIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.35" />
      <path d="M8 7.2V11.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function UploadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 10.8V3.2M8 3.2L5.2 6M8 3.2L10.8 6M3 11.5V12.5C3 13 3.4 13.4 3.9 13.4H12.1C12.6 13.4 13 13 13 12.5V11.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AtlasStarIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3V21M3 12H21M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ShuffleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.2 4.8H4.6C5.6 4.8 6.4 5.3 7.1 6.2L8.9 9.8C9.6 10.7 10.4 11.2 11.4 11.2H13.6M11.8 9.4L13.8 11.2L11.8 13M2.2 11.2H4.6C5.6 11.2 6.4 10.7 7.1 9.8M8.9 6.2C9.6 5.3 10.4 4.8 11.4 4.8H13.6M11.8 3L13.8 4.8L11.8 6.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.4" y="5.4" width="8.1" height="8.1" rx="1.8" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M10.6 5.4V3.9C10.6 3.1 10 2.5 9.2 2.5H3.9C3.1 2.5 2.5 3.1 2.5 3.9V9.2C2.5 10 3.1 10.6 3.9 10.6H5.4"
        stroke="currentColor"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function ExportIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.6V9.8M8 2.6L5.4 5.2M8 2.6L10.6 5.2M3.2 8.8V12C3.2 12.7 3.8 13.3 4.5 13.3H11.5C12.2 13.3 12.8 12.7 12.8 12V8.8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.2 8.4L6.4 11.6L12.8 4.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.35" />
      <ellipse cx="8" cy="8" rx="2.7" ry="5.8" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2.5 6.1H13.5M2.5 9.9H13.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function SettingsGearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M8 2.1V3.5M8 12.5V13.9M2.1 8H3.5M12.5 8H13.9M3.8 3.8L4.8 4.8M11.2 11.2L12.2 12.2M12.2 3.8L11.2 4.8M4.8 11.2L3.8 12.2"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PaletteIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.2C4.7 2.2 2.2 4.7 2.2 8C2.2 11.2 4.7 13.7 7.8 13.7C8.9 13.7 9.5 13 9.5 12.1C9.5 11.7 9.3 11.3 9.2 10.9C9.1 10.4 9.5 9.9 10 9.9H11.2C12.7 9.9 13.8 8.8 13.8 7.3C13.8 4.4 11.2 2.2 8 2.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="5.4" cy="7" r="0.85" fill="currentColor" />
      <circle cx="7.4" cy="4.9" r="0.85" fill="currentColor" />
      <circle cx="10.4" cy="5.7" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function SparklesIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.1L9.3 5.7L12.9 7L9.3 8.3L8 11.9L6.7 8.3L3.1 7L6.7 5.7L8 2.1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 10.4L13 12L14.6 12.6L13 13.2L12.4 14.8L11.8 13.2L10.2 12.6L11.8 12L12.4 10.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LayersIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.6L13.5 5.6L8 8.6L2.5 5.6L8 2.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 8.5L8 11.5L13.5 8.5M2.5 11.2L8 14.2L13.5 11.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HardDriveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.4 9.5H13.6" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="11.1" cy="11.2" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function KeyboardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.8" y="3.8" width="12.4" height="8.4" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.2 6.5H5.2M7 6.5H8M9.8 6.5H11.8M4.2 9.4H5.4M7 9.4H9.6M11 9.4H11.8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronUpDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M4.5 5.4L7 2.9L9.5 5.4M4.5 8.6L7 11.1L9.5 8.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderOpenIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4.5C2 3.8 2.6 3.2 3.3 3.2H6.1L7.3 4.5H12.4C13.1 4.5 13.7 5.1 13.7 5.8V6.8H3.4L2 11.8V4.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M2.2 12.2L3.5 7.2H14L12.7 12.2C12.5 12.7 12.1 13 11.6 13H3.2C2.5 13 2 12.6 2.2 12.2Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M12.8 8A4.8 4.8 0 1 1 11.4 4.6M12.8 3.2V5.8H10.2"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Cube3DIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2L13.2 5V11L8 14L2.8 11V5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M8 8L13.2 5M8 8L2.8 5M8 8V14"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AudioWaveIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.8V9.2M5.2 4.4V11.6M8 2.6V13.4M10.8 4.8V11.2M13.5 6.8V9.2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FontTypeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.6 12.6L6 3.4H7.2L10.6 12.6M3.9 9.6H9.3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.6 7.4C12.8 7.4 13.6 8 13.6 9.1V12.6M13.6 10.2C12.4 10.1 11.2 10.5 11.2 11.4C11.2 12.2 12 12.7 13.6 12.2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GifMotionIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.2" width="12" height="9.6" rx="2.2" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M6.4 6.2L10.2 8L6.4 9.8V6.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MagicWandIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="3.3"
        y="7.1"
        width="12.2"
        height="3.4"
        rx="1.7"
        transform="rotate(45 9.4 8.8)"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M6.9 6.3L9.3 8.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M13.2 2.4L13.65 3.65L14.9 4.1L13.65 4.55L13.2 5.8L12.75 4.55L11.5 4.1L12.75 3.65L13.2 2.4Z"
        fill="currentColor"
      />
      <circle cx="4.3" cy="12.5" r="0.9" fill="currentColor" />
    </svg>
  );
}



