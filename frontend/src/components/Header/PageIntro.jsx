function PageIntro({ title, description, eyebrow = "Workspace" }) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
    </div>
  );
}

export default PageIntro;
