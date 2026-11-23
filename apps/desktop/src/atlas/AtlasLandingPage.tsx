import { useEffect, useRef, useState } from "react";
import {
  FAQ_ITEMS,
  FEATURE_ITEMS,
  type AtlasViewMode,
} from "./atlas-data";
import {
  AppleLogo,
  AtlasLogo,
  ChromeIcon,
  FeatureIcon,
  PlusIcon,
} from "./AtlasIcons";
import { HeroMacShowcase } from "./HeroMacShowcase";
import { ThreeWaysShowcase } from "./ThreeWaysShowcase";
import { AtlasModals, type AtlasModalKind } from "./AtlasModals";
import "./atlas.css";

export function AtlasLandingPage() {
  const [showSticky, setShowSticky] = useState(false);
  const [previewMode, setPreviewMode] = useState<AtlasViewMode>("grid");
  const [openFaqIds, setOpenFaqIds] = useState<Set<string>>(() => new Set());
  const [modal, setModal] = useState<AtlasModalKind>(null);
  const showcaseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setShowSticky(window.scrollY > 380);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setModal("feedback");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectModeFromCards = (mode: AtlasViewMode) => {
    setPreviewMode(mode);
    showcaseRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="atlas-page">
      {/* Floating frosted sticky navigation bar (appears on scroll past Hero) */}
      <header
        className={
          showSticky
            ? "atlas-sticky-wrap atlas-sticky-wrap--visible"
            : "atlas-sticky-wrap"
        }
        aria-hidden={!showSticky}
      >
        <div className="atlas-sticky-bar">
          <button
            type="button"
            className="atlas-logo atlas-logo--compact"
            onClick={scrollToTop}
            aria-label="Atlas home"
            tabIndex={showSticky ? 0 : -1}
          >
            <AtlasLogo compact />
          </button>

          <nav className="atlas-sticky-nav" aria-label="Main navigation">
            <button
              type="button"
              className="atlas-sticky-link"
              onClick={() => setModal("download")}
              tabIndex={showSticky ? 0 : -1}
            >
              Download
            </button>
            <button
              type="button"
              className="atlas-sticky-link"
              onClick={() => setModal("whats-new")}
              tabIndex={showSticky ? 0 : -1}
            >
              What’s new
            </button>
            <button
              type="button"
              className="atlas-sticky-link"
              onClick={() => setModal("feedback")}
              tabIndex={showSticky ? 0 : -1}
            >
              Contact
            </button>
            <a
              href="https://twitter.com/atlasformac"
              target="_blank"
              rel="noreferrer"
              className="atlas-sticky-link"
              tabIndex={showSticky ? 0 : -1}
            >
              X (FKA Twitter)
            </a>
          </nav>

          <button
            type="button"
            className="atlas-sticky-cta"
            onClick={() => setModal("buy")}
            tabIndex={showSticky ? 0 : -1}
          >
            Buy now — $39
          </button>
        </div>
      </header>

      <main>
        {/* Section 1: Hero */}
        <section className="atlas-hero">
          <div className="atlas-container">
            <button
              type="button"
              className="atlas-logo"
              onClick={scrollToTop}
              aria-label="Atlas home"
            >
              <AtlasLogo />
            </button>

            <h1 className="atlas-h1">
              <span className="atlas-h1-strong">
                Home for your visual inspiration.
              </span>{" "}
              A native, local, and blazing-fast visual library for designers and
              creators.
            </h1>

            <div className="atlas-hero-actions">
              <button
                type="button"
                className="atlas-btn-primary"
                onClick={() => setModal("buy")}
              >
                Buy now — $39
              </button>
              <button
                type="button"
                className="atlas-btn-secondary"
                onClick={() => setModal("download")}
              >
                <AppleLogo size={16} />
                <span>Download</span>
              </button>
            </div>

            <div>
              <button
                type="button"
                className="atlas-chrome-link"
                onClick={() => setModal("chrome")}
              >
                <ChromeIcon size={15} />
                <span>Download Chrome extension</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Studio Display + Mac Studio Interactive Showcase */}
        <div className="atlas-container" ref={showcaseRef}>
          <HeroMacShowcase
            activeMode={previewMode}
            onModeChange={setPreviewMode}
          />
        </div>

        {/* Section 3: Three Ways to Look at Your Work */}
        <ThreeWaysShowcase onSelectMode={handleSelectModeFromCards} />

        {/* Section 4: Yours, and It Stays That Way (12-Feature Grid) */}
        <section className="atlas-section" id="features">
          <div className="atlas-container">
            <h2 className="atlas-h2">
              <span className="atlas-h2-strong">
                Yours, and it stays that way.
              </span>{" "}
              Your files, your folders, your Mac. Atlas fits around what you
              already have instead of asking you to move it.
            </h2>

            <div className="features-grid">
              {FEATURE_ITEMS.map((item) => (
                <article key={item.id} className="feature-cell">
                  <span className="feature-icon">
                    <FeatureIcon type={item.icon} />
                  </span>
                  <p className="feature-copy">
                    <span className="feature-title">{item.title}</span>{" "}
                    {item.description}
                  </p>
                  {item.badge && (
                    <span className="feature-coming-tag">{item.badge}</span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Feedback Shortcut (Cmd+Opt+F) */}
        <section className="feedback-section" id="feedback">
          <div className="atlas-container">
            <button
              type="button"
              className="keycaps-trigger"
              onClick={() => setModal("feedback")}
              aria-label="Open feedback dialog (Cmd+Opt+F)"
            >
              <span className="keycap">⌘</span>
              <span className="keycap">⌥</span>
              <span className="keycap">F</span>
            </button>

            <h2 className="atlas-h2 feedback-heading">
              <span className="atlas-h2-strong">
                Your feedback, next week&apos;s feature.
              </span>{" "}
              If you have any feedback, press Cmd+Opt+F in the app to send it
              straight into our workflow, where agents help triage and turn it
              into real product improvements.
            </h2>
          </div>
        </section>

        {/* Section 6: Questions? Answers. (Centered 768px FAQ) */}
        <section className="faq-section" id="faqs" aria-labelledby="faq-heading">
          <div className="faq-wrap">
            <h2 id="faq-heading" className="faq-title">
              Questions? Answers.
            </h2>

            <div className="faq-list">
              {FAQ_ITEMS.map((faq) => {
                const isOpen = openFaqIds.has(faq.id);
                return (
                  <div key={faq.id} className="faq-item">
                    <button
                      type="button"
                      className="faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${faq.id}`}
                      onClick={() => toggleFaq(faq.id)}
                    >
                      <PlusIcon open={isOpen} />
                      <span className="faq-question">{faq.question}</span>
                    </button>
                    {isOpen && (
                      <div
                        id={`faq-panel-${faq.id}`}
                        className="faq-answer"
                        role="region"
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Section 7: Editorial Footer */}
      <footer className="atlas-footer" aria-label="Atlas footer">
        <div className="atlas-container">
          <div className="footer-grid">
            <div>
              <p className="footer-credit">
                Designed and developed by{" "}
                <a
                  href="https://x.com/sekachov"
                  target="_blank"
                  rel="noreferrer"
                >
                  Alexey Sekachov
                </a>{" "}
                in Amsterdam and Lisbon
              </p>
              <p className="footer-copy">©2026</p>
              <div className="footer-made">
                <AppleLogo size={12} />
                <span>Made for Mac</span>
              </div>
            </div>

            <nav aria-label="Atlas links">
              <h3 className="footer-col-title">Atlas</h3>
              <ul className="footer-links">
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => setModal("download")}
                  >
                    Download
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => setModal("buy")}
                  >
                    Buy on Gumroad
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => setModal("chrome")}
                  >
                    Download Chrome extension
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => setModal("whats-new")}
                  >
                    What’s new
                  </button>
                </li>
              </ul>
            </nav>

            <nav aria-label="Information links">
              <h3 className="footer-col-title">Information</h3>
              <ul className="footer-links">
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => scrollToSection("faqs")}
                  >
                    FAQs
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => setModal("feedback")}
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <a
                    href="https://x.com/sekachov"
                    target="_blank"
                    rel="noreferrer"
                    className="footer-link"
                  >
                    Follow on X
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => setModal("privacy")}
                  >
                    Privacy policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link"
                    onClick={() => scrollToSection("views")}
                  >
                    Site map
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>

      <AtlasModals modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}
