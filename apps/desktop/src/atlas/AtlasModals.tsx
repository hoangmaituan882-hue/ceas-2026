import { useEffect, useState } from "react";
import {
  RELEASE_NOTES,
  validateEmail,
  validateFeedback,
} from "./atlas-data";
import { AppleLogo, ChromeIcon } from "./AtlasIcons";

export type AtlasModalKind =
  | null
  | "buy"
  | "download"
  | "whats-new"
  | "feedback"
  | "chrome"
  | "privacy";

interface AtlasModalsProps {
  modal: AtlasModalKind;
  onClose: () => void;
}

export function AtlasModals({ modal, onClose }: AtlasModalsProps) {
  const [provider, setProvider] = useState<"polar" | "gumroad">("polar");
  const [email, setEmail] = useState("");
  const [feedbackType, setFeedbackType] = useState<"feature" | "bug">("feature");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittedText, setSubmittedText] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSubmittedText(null);
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, onClose]);

  if (!modal) return null;

  const handleBuySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmittedText(
      `License checkout link (${provider === "polar" ? "Polar" : "Gumroad"}, $39 USD one-time) sent to ${email.trim()}. Includes 1 year of updates and perpetual offline access.`,
    );
  };

  const handleDownloadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmittedText(
      `Atlas-1.4.2-Universal.dmg download is ready for macOS 14 Sonoma or later. Your 7-day free trial key has been dispatched to ${email.trim()}.`,
    );
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateFeedback(message, email);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmittedText(
      "Feedback received and queued into our triage workflow. Thank you for helping shape next week's release.",
    );
    setMessage("");
  };

  return (
    <div
      className="atlas-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="atlas-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-modal-title"
      >
        <div className="atlas-modal-head">
          <div>
            <h3 id="atlas-modal-title" className="atlas-modal-title">
              {modal === "buy" && "Buy Atlas for Mac — $39"}
              {modal === "download" && "Download Atlas for Mac"}
              {modal === "whats-new" && "What’s new"}
              {modal === "feedback" && "Send feedback"}
              {modal === "chrome" && "Add to Atlas for Chrome"}
              {modal === "privacy" && "Privacy policy"}
            </h3>
          </div>
          <button
            type="button"
            className="atlas-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {modal === "buy" && (
          <>
            <p className="atlas-modal-sub">
              One-time purchase of $39 USD. No subscription. Includes one year of
              updates and perpetual use on your Mac.
            </p>

            <div className="atlas-segmented" style={{ marginTop: "18px" }}>
              <button
                type="button"
                className={
                  provider === "polar"
                    ? "atlas-seg-btn atlas-seg-btn--active"
                    : "atlas-seg-btn"
                }
                onClick={() => setProvider("polar")}
              >
                Checkout via Polar
              </button>
              <button
                type="button"
                className={
                  provider === "gumroad"
                    ? "atlas-seg-btn atlas-seg-btn--active"
                    : "atlas-seg-btn"
                }
                onClick={() => setProvider("gumroad")}
              >
                Buy on Gumroad
              </button>
            </div>

            {submittedText ? (
              <div className="atlas-success-box" role="status">
                {submittedText}
              </div>
            ) : (
              <form className="atlas-form" onSubmit={handleBuySubmit} noValidate>
                <div>
                  <label className="atlas-field-label" htmlFor="buy-email">
                    License email
                  </label>
                  <input
                    id="buy-email"
                    type="email"
                    className="atlas-input"
                    placeholder="you@studio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="atlas-form-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="atlas-btn-primary">
                  Continue — $39 USD
                </button>
              </form>
            )}

            <ul className="atlas-spec-list">
              <li>· Native macOS 14 Sonoma+ app (Apple Silicon &amp; Intel)</li>
              <li>· Unlimited libraries, collections, and connected folders</li>
              <li>· Safari &amp; Chrome extensions included</li>
            </ul>
          </>
        )}

        {modal === "download" && (
          <>
            <p className="atlas-modal-sub">
              Start a 7-day free trial with up to 5 boards. Requires macOS 14
              Sonoma or later.
            </p>

            {submittedText ? (
              <div className="atlas-success-box" role="status">
                {submittedText}
              </div>
            ) : (
              <form
                className="atlas-form"
                onSubmit={handleDownloadSubmit}
                noValidate
              >
                <div>
                  <label className="atlas-field-label" htmlFor="dl-email">
                    Email for 7-day trial
                  </label>
                  <input
                    id="dl-email"
                    type="email"
                    className="atlas-input"
                    placeholder="you@studio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="atlas-form-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="atlas-btn-primary">
                  <AppleLogo size={15} />
                  <span>Download Atlas 1.4.2 (.dmg)</span>
                </button>
              </form>
            )}
          </>
        )}

        {modal === "whats-new" && (
          <>
            <p className="atlas-modal-sub">
              Recent updates shipped directly from community feedback.
            </p>
            <div className="atlas-release-list">
              {RELEASE_NOTES.map((note) => (
                <article key={note.version} className="atlas-release-item">
                  <div className="atlas-release-meta">
                    v{note.version} · {note.date}
                  </div>
                  <h4 className="atlas-release-heading">{note.title}</h4>
                  <ul className="atlas-release-bullets">
                    {note.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        )}

        {modal === "feedback" && (
          <>
            <p className="atlas-modal-sub">
              Triggered via Cmd+Opt+F. Share a feature request or bug report
              straight into our triage workflow.
            </p>

            <div className="atlas-segmented" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className={
                  feedbackType === "feature"
                    ? "atlas-seg-btn atlas-seg-btn--active"
                    : "atlas-seg-btn"
                }
                onClick={() => setFeedbackType("feature")}
              >
                Feature request
              </button>
              <button
                type="button"
                className={
                  feedbackType === "bug"
                    ? "atlas-seg-btn atlas-seg-btn--active"
                    : "atlas-seg-btn"
                }
                onClick={() => setFeedbackType("bug")}
              >
                Bug report
              </button>
            </div>

            {submittedText ? (
              <div className="atlas-success-box" role="status">
                {submittedText}
              </div>
            ) : (
              <form
                className="atlas-form"
                onSubmit={handleFeedbackSubmit}
                noValidate
              >
                <div>
                  <label className="atlas-field-label" htmlFor="fb-message">
                    {feedbackType === "feature"
                      ? "What should we build next?"
                      : "What happened?"}
                  </label>
                  <textarea
                    id="fb-message"
                    className="atlas-textarea"
                    placeholder="Describe your workflow, idea, or macOS version..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="atlas-field-label" htmlFor="fb-email">
                    Reply email (optional)
                  </label>
                  <input
                    id="fb-email"
                    type="email"
                    className="atlas-input"
                    placeholder="you@studio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="atlas-form-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="atlas-btn-primary">
                  Send feedback
                </button>
              </form>
            )}
          </>
        )}

        {modal === "chrome" && (
          <>
            <p className="atlas-modal-sub">
              Right-click any image, video, or page in Chrome and send it
              straight to an Atlas collection on your Mac.
            </p>
            <div className="atlas-success-box" style={{ marginTop: "18px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                <ChromeIcon size={16} />
                <span>Add to Atlas — Chrome Web Store</span>
              </div>
              Works with Chrome, Arc, Brave, and Dia. Requires Atlas for Mac
              installed locally. Safari extension is bundled inside the Mac app.
            </div>
            <div style={{ marginTop: "18px", display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="atlas-btn-primary"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </>
        )}

        {modal === "privacy" && (
          <>
            <p className="atlas-modal-sub">
              Your visual library stays 100% local on your Mac. Atlas never
              uploads your images, videos, or folders to an Atlas cloud server.
            </p>
            <ul className="atlas-spec-list">
              <li>· Local-first storage: internal disk, external drive, or your own cloud sync</li>
              <li>· License checks and update pings never include library content</li>
              <li>· External AI assistants via MCP only access tools you explicitly enable</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
