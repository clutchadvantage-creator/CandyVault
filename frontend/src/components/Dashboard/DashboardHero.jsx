import DashboardHeroDecorations from "../../theme/ThemeDecorations.jsx";
import { useTheme } from "../../theme/useTheme.js";

const openedAt = new Date();

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const greeting = greetingForHour(openedAt.getHours());
const currentDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(openedAt);

function DashboardHero() {
  const { themeDefinition } = useTheme();
  return (
    <section className="dashboard-hero">
      <div className="hero-copy">
        <div className="hero-greeting">{greeting}, {themeDefinition.language.keeperGreeting}!</div>
        <h1>CandyVault</h1>
        <p className="hero-server">Running on <strong>candyserver</strong></p>
        <div className="hero-date">{currentDate}</div>
      </div>

      <DashboardHeroDecorations />
    </section>
  );
}

export default DashboardHero;
