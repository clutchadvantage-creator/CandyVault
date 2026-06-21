import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiUrl } from "../api/client.js";
import StatCard from "../components/Cards/StatCard.jsx";
import PageIntro from "../components/Header/PageIntro.jsx";
import { useTheme } from "../theme/useTheme.js";

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "No backups yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function responseError(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // Use the friendly fallback when no JSON error is available.
  }
  return fallback;
}

function Settings() {
  const { theme, themeDefinition, availableThemes, setTheme } = useTheme();
  const [backups, setBackups] = useState([]);
  const [health, setHealth] = useState({
    total_backups: 0,
    latest_backup_date: null,
    total_backup_storage: 0,
    database_file_exists: false,
    uploads_directory_exists: false,
    backup_directory_exists: false,
    warnings: [],
  });
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inspectingName, setInspectingName] = useState("");
  const [deletingName, setDeletingName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchBackupData = useCallback(async (signal) => {
    const [backupsResponse, healthResponse] = await Promise.all([
      apiFetch("/backups", { signal }),
      apiFetch("/backups/health", { signal }),
    ]);
    if (!backupsResponse.ok || !healthResponse.ok) {
      throw new Error("Backup safety information could not be loaded from candyserver.");
    }
    const [backupData, healthData] = await Promise.all([
      backupsResponse.json(),
      healthResponse.json(),
    ]);
    if (!Array.isArray(backupData)) throw new Error("candyserver returned an invalid backup list.");
    return { backupData, healthData };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBackups() {
      try {
        const { backupData, healthData } = await fetchBackupData(controller.signal);
        setBackups(backupData);
        setHealth(healthData);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadBackups();
    return () => controller.abort();
  }, [fetchBackupData]);

  async function refreshBackups() {
    const { backupData, healthData } = await fetchBackupData();
    setBackups(backupData);
    setHealth(healthData);
  }

  async function handleCreateBackup() {
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch("/backups/create", { method: "POST" });
      if (!response.ok) {
        throw new Error(await responseError(response, "The backup could not be created."));
      }
      const backup = await response.json();
      await refreshBackups();
      setSuccess(`${backup.filename} is tucked safely onto the backup shelf.`);
    } catch (requestError) {
      setError(requestError.message || "The backup could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function handleInspectBackup(backup) {
    setInspectingName(backup.filename);
    setError("");
    try {
      const response = await apiFetch(`/backups/${encodeURIComponent(backup.filename)}/inspect`);
      if (!response.ok) {
        throw new Error(await responseError(response, "The backup could not be inspected."));
      }
      setInspection(await response.json());
    } catch (requestError) {
      setError(requestError.message || "The backup could not be inspected.");
    } finally {
      setInspectingName("");
    }
  }

  async function handleDeleteBackup(backup) {
    if (!window.confirm(`Delete backup "${backup.filename}"? This cannot be undone.`)) return;
    setDeletingName(backup.filename);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(`/backups/${encodeURIComponent(backup.filename)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "The backup could not be deleted."));
      }
      if (inspection?.filename === backup.filename) setInspection(null);
      await refreshBackups();
      setSuccess("Backup removed from the shelf.");
    } catch (requestError) {
      setError(requestError.message || "The backup could not be deleted.");
    } finally {
      setDeletingName("");
    }
  }

  const healthLabel = health.warnings.length === 0 ? "Healthy" : "Attention";
  const healthTone = health.warnings.length === 0 ? "healthy" : "checking";

  return (
    <>
      <PageIntro
        eyebrow="Vault operations"
        title="Settings"
        description="Create, inspect, and download portable copies of the CandyVault database and document candy jars."
      />

      <section className="theme-system-status" aria-labelledby="theme-system-title">
        <div className="theme-status-mark" aria-hidden="true">CV</div>
        <div>
          <span>Theme System Status</span>
          <h2 id="theme-system-title">Current Theme: {themeDefinition.name}</h2>
          <p>Your selection applies immediately and stays saved on this browser.</p>
        </div>
        <strong>Active</strong>
      </section>

      <section className="theme-selector-panel" aria-labelledby="theme-selector-title">
        <div className="theme-selector-heading">
          <span>Appearance</span>
          <h2 id="theme-selector-title">Choose a Theme</h2>
          <p>Pick the atmosphere that feels most at home. CandyVault features and data remain unchanged.</p>
        </div>
        <div className="theme-card-grid" role="radiogroup" aria-label="CandyVault theme">
          {Object.values(availableThemes).map((option) => (
            <label className={`theme-choice-card${theme === option.id ? " selected" : ""}`} key={option.id}>
              <input
                type="radio"
                name="candyvault-theme"
                value={option.id}
                checked={theme === option.id}
                onChange={() => setTheme(option.id)}
              />
              <span className="theme-preview" aria-hidden="true">
                {option.previewColors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
              </span>
              <span className="theme-choice-copy">
                <strong>{option.name}</strong>
                <small>{option.description}</small>
              </span>
              <b>{theme === option.id ? "Selected" : "Choose"}</b>
            </label>
          ))}
        </div>
      </section>

      <section className="stats-grid backup-summary-grid" aria-label="Backup summary">
        <StatCard label="Backup Health" value={healthLabel} detail={health.warnings.length ? `${health.warnings.length} item needs attention` : "All backup paths are ready"} icon="OK" statusTone={healthTone} />
        <StatCard label="Available Backups" value={String(health.total_backups)} detail="ZIP archives on the shelf" icon="ZIP" />
        <StatCard label="Backup Storage" value={formatFileSize(health.total_backup_storage)} detail="Space used by backups" icon="MB" />
        <StatCard label="Latest Backup" value={formatDate(health.latest_backup_date)} detail="Most recent vault snapshot" icon="NEW" />
      </section>

      {error && <div className="expense-alert" role="alert">{error}</div>}
      {success && <div className="document-success" role="status">{success}</div>}

      {health.warnings.length > 0 && (
        <section className="backup-health-warnings" aria-label="Backup health warnings">
          <strong>Backup safety notes</strong>
          <ul>{health.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>
      )}

      <section className="backup-manager">
        <div className="backup-manager-header">
          <div>
            <span>Local protection</span>
            <h2>Backup Management</h2>
            <p>Each ZIP includes the SQLite database, uploaded documents, folder structure, and a manifest.</p>
          </div>
          <button className="primary-button backup-create-button" type="button" onClick={handleCreateBackup} disabled={creating}>
            {creating ? "Packing the vault…" : "Create Backup"}
          </button>
        </div>

        {loading ? (
          <div className="backup-state" role="status">Checking the backup shelf…</div>
        ) : backups.length === 0 ? (
          <div className="backup-state">
            <span aria-hidden="true">B</span>
            <strong>The backup candy shelf is empty.</strong>
            <p>Create your first portable CandyVault snapshot.</p>
          </div>
        ) : (
          <div className="backup-list">
            {backups.map((backup) => (
              <article className="backup-card" key={backup.filename}>
                <div className="backup-icon" aria-hidden="true">ZIP</div>
                <div className="backup-copy">
                  <strong>{backup.filename}</strong>
                  <span>{formatDate(backup.created_at)} · {formatFileSize(backup.file_size)} · {backup.total_files} files</span>
                </div>
                <div className="backup-actions">
                  <button type="button" onClick={() => handleInspectBackup(backup)} disabled={inspectingName === backup.filename}>
                    {inspectingName === backup.filename ? "Inspecting…" : "Inspect"}
                  </button>
                  <a href={apiUrl(`/backups/${encodeURIComponent(backup.filename)}/download`)}>Download</a>
                  <button type="button" onClick={() => handleDeleteBackup(backup)} disabled={deletingName === backup.filename}>
                    {deletingName === backup.filename ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {inspection && (
        <section className="backup-inspection" aria-label="Backup inspection preview">
          <div className="backup-inspection-header">
            <div><span>Safety preview</span><h2>{inspection.filename}</h2></div>
            <button type="button" onClick={() => setInspection(null)}>Close preview</button>
          </div>
          <div className="backup-inspection-checks">
            <div className={inspection.included_database_file ? "included" : "missing"}><strong>Database</strong><span>{inspection.included_database_file ? "Included" : "Missing"}</span></div>
            <div className={inspection.included_uploads ? "included" : "missing"}><strong>Uploads</strong><span>{inspection.included_uploads ? "Included" : "Missing"}</span></div>
            <div className={inspection.included_document_folders ? "included" : "missing"}><strong>Folders</strong><span>{inspection.included_document_folders ? "Included" : "Missing"}</span></div>
            <div><strong>Files</strong><span>{inspection.included_file_count}</span></div>
          </div>
          {inspection.warnings.length > 0 ? (
            <div className="inspection-warnings"><strong>Warnings</strong><ul>{inspection.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
          ) : <div className="inspection-clean">No backup warnings detected.</div>}
          <div className="manifest-preview">
            <h3>backup-manifest.json</h3>
            <pre>{JSON.stringify(inspection.manifest, null, 2)}</pre>
          </div>
        </section>
      )}

      <section className="restore-prep" aria-label="Restore backup preparation">
        <div><span>Future safety tool</span><h2>Restore Backup</h2><p>Restore is not enabled yet. Backups can currently be created, inspected, downloaded, and deleted.</p></div>
        <button type="button" disabled>Restore Backup — Coming Later</button>
      </section>
    </>
  );
}

export default Settings;
