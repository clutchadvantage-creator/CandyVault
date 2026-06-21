import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../../theme/useTheme.js";

function getControlLabel(control) {
  return (
    control.getAttribute("aria-label")
    || control.getAttribute("title")
    || control.textContent
    || "Action complete"
  ).trim().replace(/\s+/g, " ").slice(0, 54);
}

function InteractionFeedback() {
  const location = useLocation();
  const { themeDefinition } = useTheme();
  const feedbackIcons = themeDefinition.decorations.feedbackIcons;
  const nextBurstId = useRef(0);
  const messageTimer = useRef(null);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [message, setMessage] = useState("");
  const [bursts, setBursts] = useState([]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      setShowProgress(true);
      setProgress(16);
    }, 0);
    const middleTimer = window.setTimeout(() => setProgress(72), 80);
    const completeTimer = window.setTimeout(() => setProgress(100), 260);
    const hideTimer = window.setTimeout(() => setShowProgress(false), 640);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(middleTimer);
      window.clearTimeout(completeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [location.pathname]);

  useEffect(() => {
    function acknowledge(event) {
      const control = event.target.closest("button, a, [role='button']");
      if (!control || control.matches(":disabled, [aria-disabled='true']")) return;

      const label = getControlLabel(control);
      const bounds = control.getBoundingClientRect();
      const originX = event.clientX || bounds.left + bounds.width / 2;
      const originY = event.clientY || bounds.top + bounds.height / 2;
      const celebratesClose = /close|cancel|dismiss/i.test(label) || control.hasAttribute("data-confetti-close");
      const burstCount = celebratesClose ? 16 : 2;
      const created = Array.from({ length: burstCount }, (_, index) => {
        const id = nextBurstId.current++;
        const angle = celebratesClose ? (Math.PI * 2 * index) / burstCount : Math.PI * (0.9 + index * 0.2);
        const distance = celebratesClose ? 42 + (index % 4) * 14 : 20;
        return {
          id,
          icon: feedbackIcons[(id + index) % feedbackIcons.length],
          x: originX,
          y: originY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - (celebratesClose ? 18 : 8),
          delay: (index % 4) * 24,
        };
      });

      setBursts((current) => [...current, ...created]);
      window.setTimeout(() => {
        const ids = new Set(created.map((item) => item.id));
        setBursts((current) => current.filter((item) => !ids.has(item.id)));
      }, 900);

      setMessage(`${celebratesClose ? "🎉" : "✓"} ${label}`);
      window.clearTimeout(messageTimer.current);
      messageTimer.current = window.setTimeout(() => setMessage(""), 1500);
    }

    document.addEventListener("click", acknowledge);
    return () => {
      document.removeEventListener("click", acknowledge);
      window.clearTimeout(messageTimer.current);
    };
  }, [feedbackIcons]);

  return (
    <div className="interaction-feedback">
      <div
        className={`app-progress${showProgress ? " visible" : ""}`}
        role="progressbar"
        aria-label="Page loading progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
        <b>{progress}%</b>
      </div>

      {message && <div className="action-acknowledgement" role="status" aria-live="polite">{message}</div>}

      <div className="candy-burst-layer" aria-hidden="true">
        {bursts.map((burst) => (
          <span
            className="candy-burst-piece"
            key={burst.id}
            style={{
              left: burst.x,
              top: burst.y,
              "--burst-x": `${burst.dx}px`,
              "--burst-y": `${burst.dy}px`,
              animationDelay: `${burst.delay}ms`,
            }}
          >
            {burst.icon}
          </span>
        ))}
      </div>
    </div>
  );
}

export default InteractionFeedback;
