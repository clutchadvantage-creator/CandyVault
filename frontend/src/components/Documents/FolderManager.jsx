import { useState } from "react";
import { apiFetch } from "../../api/client.js";


function emptyFolderForm() {
  return { name: "", description: "" };
}

async function responseError(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // Use the friendly fallback when the response has no JSON body.
  }
  return fallback;
}

function FolderManager({ folders, onChanged, onFeedback }) {
  const [form, setForm] = useState(emptyFolderForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(emptyFolderForm());
    setEditingId(null);
  }

  function startEditing(folder) {
    setForm({ name: folder.name, description: folder.description || "" });
    setEditingId(folder.id);
    onFeedback("", "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    onFeedback("", "");
    const isEditing = editingId !== null;

    try {
      const response = await apiFetch(
        isEditing ? `/document-folders/${editingId}` : "/document-folders",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (!response.ok) {
        throw new Error(await responseError(response, "The candy jar could not be saved."));
      }
      resetForm();
      await onChanged();
      onFeedback("success", isEditing ? "Candy jar renamed safely." : "New document candy jar created!");
    } catch (requestError) {
      onFeedback("error", requestError.message || "The candy jar could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(folder) {
    if (!window.confirm(`Delete empty candy jar "${folder.name}"?`)) return;
    setDeletingId(folder.id);
    onFeedback("", "");

    try {
      const response = await apiFetch(`/document-folders/${folder.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "The candy jar could not be deleted."));
      }
      if (editingId === folder.id) resetForm();
      await onChanged(folder.id);
      onFeedback("success", "Empty candy jar removed.");
    } catch (requestError) {
      onFeedback("error", requestError.message || "The candy jar could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="folder-manager" aria-label="Document folder management">
      <div className="folder-manager-header">
        <div>
          <span>CandyVault organizers</span>
          <h2>Candy Jars</h2>
          <p>Create folders for the document flavors your household keeps.</p>
        </div>
        <div className="folder-count">{folders.length} jars</div>
      </div>

      <div className="folder-manager-content">
        <form className="folder-form" onSubmit={handleSubmit}>
          <h3>{editingId !== null ? "Rename candy jar" : "Create a candy jar"}</h3>
          <label className="form-field">
            <span>Folder name</span>
            <input name="name" value={form.name} onChange={updateField} maxLength="120" placeholder="e.g. Insurance Docs" required />
          </label>
          <label className="form-field">
            <span>Description</span>
            <textarea name="description" value={form.description} onChange={updateField} maxLength="1000" rows="3" placeholder="What belongs in this jar?" />
          </label>
          <div className="folder-form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId !== null ? "Save jar changes" : "Create candy jar"}
            </button>
            {editingId !== null && <button className="secondary-button" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>

        <div className="folder-list">
          {folders.length === 0 ? (
            <div className="folder-list-empty">
              <span aria-hidden="true">J</span>
              <div><strong>No candy jars yet.</strong><p>General Documents is always available.</p></div>
            </div>
          ) : (
            folders.map((folder, index) => (
              <article className={`folder-card folder-color-${index % 4}`} key={folder.id}>
                <div className="folder-card-icon" aria-hidden="true">J</div>
                <div className="folder-card-copy">
                  <strong>{folder.name}</strong>
                  <span>/{folder.slug}</span>
                  <p>{folder.description || "A household document candy jar."}</p>
                </div>
                <div className="folder-card-actions">
                  <button type="button" onClick={() => startEditing(folder)}>Edit</button>
                  <button type="button" onClick={() => handleDelete(folder)} disabled={deletingId === folder.id}>
                    {deletingId === folder.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default FolderManager;
