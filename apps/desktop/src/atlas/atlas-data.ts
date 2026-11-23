export type AtlasViewMode = "grid" | "canvas" | "infinity";

export interface GalleryItem {
  id: string;
  title: string;
  collection: string;
  image: string;
  aspect: "landscape" | "portrait" | "square";
  bg: string;
  x: number;
  y: number;
  width: number;
}

export interface CollectionMeta {
  id: string;
  name: string;
  count: number;
}

export interface FeatureItem {
  id: string;
  icon:
    | "collections"
    | "local"
    | "browser"
    | "menubar"
    | "folders"
    | "customizable"
    | "native"
    | "fast"
    | "eagle"
    | "ios"
    | "links"
    | "mcp";
  title: string;
  description: string;
  badge?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const SIDEBAR_COLLECTIONS: CollectionMeta[] = [
  { id: "all", name: "All Items", count: 110 },
  { id: "macos-apps", name: "macOS Apps", count: 42 },
  { id: "onboarding", name: "Onboarding screens", count: 23 },
  { id: "app-icons", name: "App Icons", count: 18 },
  { id: "logo-branding", name: "Logo & Branding", count: 15 },
  { id: "memes", name: "Memes", count: 8 },
  { id: "portfolio", name: "Portfolio", count: 4 },
];

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    id: "collections",
    icon: "collections",
    title: "Collections.",
    description:
      "Drag items in, drag collections into any order, nest what belongs together.",
  },
  {
    id: "local-first",
    icon: "local",
    title: "Local-first, store anywhere.",
    description:
      "Internal disk, external drive, Dropbox, iCloud. Your library goes where you want it.",
  },
  {
    id: "browser-extensions",
    icon: "browser",
    title: "Browser extensions.",
    description:
      "Right-click any image or video on the web and send it straight to a collection.",
  },
  {
    id: "menu-bar",
    icon: "menubar",
    title: "Menu bar pin.",
    description:
      "Drop anything onto the icon in your menu bar. It lands in your Inbox.",
  },
  {
    id: "connected-folders",
    icon: "folders",
    title: "Connected folders.",
    description:
      "Browse a folder as fast as your library. Your files stay exactly where they are.",
  },
  {
    id: "customizable",
    icon: "customizable",
    title: "Endlessly customizable.",
    description:
      "Spacing, corners, backgrounds, light or dark. Make it look like yours.",
  },
  {
    id: "native",
    icon: "native",
    title: "Fully native, not a web gimmick.",
    description:
      "Atlas speaks the rest of your Mac fluently. Built on Apple's own frameworks.",
  },
  {
    id: "blazing-fast",
    icon: "fast",
    title: "Blazing fast.",
    description:
      "Scroll, zoom, and drag through thousands of items without a single hitch. Speed you feel in the first ten seconds.",
  },
  {
    id: "eagle",
    icon: "eagle",
    title: "Bring your Eagle library.",
    description:
      "Connect what you already have and pick up where you left off. Nothing to rebuild.",
  },
  {
    id: "ios",
    icon: "ios",
    title: "iOS companion App.",
    description:
      "Save anything on the go and it's waiting in your Inbox when you sit down.",
    badge: "COMING FALL '26",
  },
  {
    id: "links",
    icon: "links",
    title: "Links.",
    description:
      "Save URLs, articles, references, and shop pages, and organize them in collections.",
  },
  {
    id: "mcp",
    icon: "mcp",
    title: "MCP support.",
    description: "Teach your agent your taste.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-atlas",
    question: "What is Atlas for Mac?",
    answer:
      "Atlas is a native Mac app for collecting visual inspiration. Keep reference images, videos, and links together, organize them into collections, and explore your library in a grid, on a canvas, or in Infinity view. It is built for designers, artists, and anyone who saves things to come back to.",
  },
  {
    id: "try-before-buying",
    question: "Can I try Atlas before buying?",
    answer:
      "Yes. Download Atlas and start a 7-day free trial with up to 5 boards. Enter your email in the app to begin. A license removes the trial limits.",
  },
  {
    id: "subscription",
    question: "Is Atlas a subscription?",
    answer:
      "No. Atlas is a one-time purchase of $39 USD. Your license includes one year of updates; you can keep using the versions covered by your license after that year. Renew only when you want access to newer versions.",
  },
  {
    id: "which-macs",
    question: "Which Macs can run Atlas?",
    answer:
      "Atlas requires macOS 14 Sonoma or later. Download the app to try it on your Mac before purchasing. Atlas is a native macOS app, rather than a website wrapped in a desktop window.",
  },
  {
    id: "what-can-i-save",
    question: "What can I save in Atlas?",
    answer:
      "Collect images, videos, and web links, including articles, product pages, and design references. Use collections to bring related material together, and choose the view that suits the work: a grid for browsing, a canvas for arranging ideas, or Infinity for exploring.",
  },
  {
    id: "where-files-stored",
    question: "Where are my files stored?",
    answer:
      "Your library stays in folders on your Mac. Atlas can also connect to existing folders, so you can work with files where you already keep them. You control your storage and backups; Atlas does not require you to upload your visual library to an Atlas cloud service.",
  },
  {
    id: "share-with-team",
    question: "How can I share my Atlas library with my team?",
    answer:
      "Store your Atlas library in a cloud folder and share it with your team. Dropbox, Google Drive, iCloud, or another cloud service that syncs files to your Mac can handle sharing. Give your teammates access to the library file through that service, and each person can open the shared library in Atlas on their Mac.",
  },
  {
    id: "sync-between-macs",
    question: "Can I sync my Atlas library between Macs?",
    answer:
      "Yes. Keep your Atlas library in a cloud folder to use it across your Macs. Save the library file in Dropbox, Google Drive, iCloud, or another cloud service that syncs files between devices, then open that synced library in Atlas on each Mac. Your cloud service handles the syncing, so you can move between your desktop and laptop with the same library.",
  },
  {
    id: "use-offline",
    question: "Can I use Atlas offline?",
    answer:
      "You can browse and organize files stored locally on your Mac without an internet connection. Starting a trial, activating a license, downloading updates, and opening web links need internet access. Files in a cloud-synced folder must be downloaded to your Mac to be available offline.",
  },
  {
    id: "eagle-library",
    question: "Can I use my existing Eagle library?",
    answer:
      "Yes. Atlas can connect to an existing Eagle library, so you do not have to start your collection again. Keep a backup before making changes to any library.",
  },
  {
    id: "save-from-browser",
    question: "Can I save inspiration from my browser?",
    answer:
      "Yes. Add to Atlas is available for Safari and Chrome, so you can save images, videos, and links while browsing. The Safari extension is included with Atlas: open Settings → Extensions in the app to enable it in Safari. Install the Chrome extension from the Chrome Web Store. Both send what you save to your Atlas library.",
  },
  {
    id: "ai-assistants",
    question: "How does Atlas work with AI assistants?",
    answer:
      "Atlas supports the Model Context Protocol (MCP), which lets compatible AI assistants work with your library through the tools Atlas exposes. Connect an assistant in Atlas’s MCP settings to bring your references into your workflow. Any content you share with an external assistant is also subject to that provider’s privacy practices.",
  },
  {
    id: "analytics",
    question: "Does Atlas collect analytics?",
    answer:
      "Your library is local. The app uses services for licensing, updates, and usage analytics; the website loads Google Analytics only if you accept analytics cookies.",
  },
  {
    id: "updates-and-help",
    question: "How do I get updates or ask for help?",
    answer:
      "Atlas checks for updates in the app. You can also read the release notes to see what has changed. For a bug, license question, or feature request, press Cmd+Opt+F in Atlas or email asekachov@gmail.com with your macOS version and Atlas version.",
  },
];

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.4.2",
    date: "October 2026",
    title: "MCP Server & Eagle Library Connector",
    highlights: [
      "Model Context Protocol (MCP) server for connecting visual taste directly to compatible AI agents.",
      "Direct read-and-browse connector for existing Eagle libraries without rebuilding folders.",
      "Improved Metal thumbnail pipeline for 10,000+ item collections at 120fps.",
    ],
  },
  {
    version: "1.3.0",
    date: "August 2026",
    title: "Infinity View & Menu Bar Pin",
    highlights: [
      "New Infinity View for edge-free spatial drifting across your entire archive.",
      "Drag any image, video, or URL onto the macOS menu bar icon to capture directly into Inbox.",
      "Web links now preserve rich previews, titles, and source domains.",
    ],
  },
  {
    version: "1.2.0",
    date: "May 2026",
    title: "Connected Folders & Canvas Grouping",
    highlights: [
      "Connect any local Finder folder without moving or duplicating your files.",
      "Magnetic alignment guides and freeform clusters inside Canvas view.",
      "Fine-grained spacing, corner radius, and light/dark appearance preferences.",
    ],
  },
];

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1.2;
  return Math.round(Math.min(1.8, Math.max(0.7, value)) * 10) / 10;
}

export function filterGalleryItems<T extends { collection: string }>(
  items: readonly T[],
  activeCollection: string,
): T[] {
  if (!activeCollection || activeCollection === "all") return [...items];
  return items.filter((item) => item.collection === activeCollection);
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Please enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function validateFeedback(message: string, email: string): string | null {
  const trimmedMessage = message.trim();
  if (trimmedMessage.length < 6) {
    return "Please describe your idea or issue (at least 6 characters).";
  }
  if (email.trim()) {
    return validateEmail(email);
  }
  return null;
}
