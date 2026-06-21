import { useTheme } from "./useTheme.js";

function DashboardHeroDecorations() {
  const { themeDefinition } = useTheme();
  const [candy, soda, cupcake] = themeDefinition.decorations.heroTreats;

  return (
    <>
      <div className={`hero-candy hero-decoration-${themeDefinition.decorationStyle}`} aria-hidden="true">
        <div className="hero-lollipop"><span /></div>
        <div className="hero-spark hero-spark-one">✦</div>
        <div className="hero-spark hero-spark-two">●</div>
        <div className="hero-spark hero-spark-three">✦</div>
        <span className="hero-treat hero-treat-candy">{candy}</span>
        <span className="hero-treat hero-treat-soda">{soda}</span>
        <span className="hero-treat hero-treat-cupcake">{cupcake}</span>
      </div>
      <div className={`hero-stripe hero-runner-${themeDefinition.decorationStyle}`} aria-hidden="true"><span>{themeDefinition.decorations.heroRunner}</span></div>
    </>
  );
}

export default DashboardHeroDecorations;
