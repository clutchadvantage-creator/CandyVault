import { useTheme } from "../../theme/useTheme.js";

function PlaceholderCard({ title, description, marker }) {
  const { themeDefinition } = useTheme();
  return (
    <section className="panel placeholder-panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <span className="panel-kicker">Candy jar</span>
      </div>
      <div className="empty-state candy-jar-state">
        <div>
          <div className="candy-jar-illustration" aria-hidden="true">
            <span className="jar-lid" />
            <span className="jar-glass">
              <i className="jar-candy candy-one" />
              <i className="jar-candy candy-two" />
              <i className="jar-candy candy-three" />
            </span>
            <b>{marker}</b>
          </div>
          <h3>{themeDefinition.language.emptyContainer}</h3>
          <p>{description}</p>
        </div>
      </div>
    </section>
  );
}

export default PlaceholderCard;
