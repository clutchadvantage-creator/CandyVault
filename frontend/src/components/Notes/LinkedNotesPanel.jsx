import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";

const categories = ["Personal", "Ideas", "Work", "Reminders", "Reference", "Other"];

function emptyForm() {
  return { title: "", category: "", content: "" };
}

function formatDate(value) {
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
    // Use the friendly fallback when the response has no JSON body.
  }
  return fallback;
}

function LinkedNotesPanel({ linkedType, linkedId, title, onClose, onNotesChange }) {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotes() {
      try {
        const response = await apiFetch(`/notes/linked/${linkedType}/${linkedId}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Attached notes could not be loaded.");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("candyserver returned an invalid notes list.");
        setNotes(data);
        onNotesChange?.(linkedId, data.length);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadNotes();
    return () => controller.abort();
  }, [linkedId, linkedType, onNotesChange]);

  async function refreshNotes() {
    const response = await apiFetch(`/notes/linked/${linkedType}/${linkedId}`);
    if (!response.ok) throw new Error("Attached notes could not be refreshed.");
    const data = await response.json();
    setNotes(data);
    onNotesChange?.(linkedId, data.length);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function startEditing(note) {
    setForm({ title: note.title, category: note.category, content: note.content });
    setEditingId(note.id);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const isEditing = editingId !== null;
    const endpoint = isEditing
      ? `/notes/${editingId}`
      : `/notes/linked/${linkedType}/${linkedId}`;
    const payload = isEditing
      ? { ...form, linked_type: linkedType, linked_id: linkedId }
      : form;

    try {
      const response = await apiFetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "The attached note could not be saved."));
      }
      resetForm();
      await refreshNotes();
    } catch (requestError) {
      setError(requestError.message || "The attached note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm(`Delete attached note "${note.title}"? This cannot be undone.`)) return;

    setDeletingId(note.id);
    setError("");
    try {
      const response = await apiFetch(`/notes/${note.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await responseError(response, "The attached note could not be deleted."));
      }
      if (editingId === note.id) resetForm();
      await refreshNotes();
    } catch (requestError) {
      setError(requestError.message || "The attached note could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="linked-notes-panel" aria-label={`Attached notes for ${title}`}>
      <div className="linked-notes-header">
        <div>
          <span className={`linked-item-badge badge-${linkedType}`}>{linkedType} notes</span>
          <h2>Attached Notes</h2>
          <p>Following: <strong>{title}</strong></p>
        </div>
        {onClose && <button className="linked-notes-close" type="button" onClick={onClose} aria-label="Close attached notes">Close</button>}
      </div>

      {error && <div className="linked-notes-error" role="alert">{error}</div>}

      <div className="linked-notes-content">
        <form className="linked-note-form" onSubmit={handleSubmit}>
          <h3>{editingId !== null ? "Edit attached note" : "Attach a note"}</h3>
          <label className="form-field">
            <span>Title</span>
            <input name="title" value={form.title} onChange={updateField} maxLength="255" placeholder="Note title" required />
          </label>
          <label className="form-field">
            <span>Category</span>
            <select name="category" value={form.category} onChange={updateField} required>
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Content</span>
            <textarea name="content" value={form.content} onChange={updateField} maxLength="10000" rows="5" placeholder="Add context for this item…" required />
          </label>
          <div className="linked-note-form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId !== null ? "Save attached note" : "Attach note"}
            </button>
            {editingId !== null && <button className="secondary-button" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>

        <div className="linked-notes-list">
          <div className="linked-notes-list-heading">
            <h3>Notes following this item</h3>
            <span>{notes.length}</span>
          </div>
          {loading ? (
            <div className="linked-notes-state" role="status">Unwrapping attached notes…</div>
          ) : notes.length === 0 ? (
            <div className="linked-notes-state">No notes are following this item yet.</div>
          ) : (
            <div className="linked-note-card-grid">
              {notes.map((note, index) => (
                <article className={`linked-note-card note-color-${index % 4}`} key={note.id}>
                  <span className="linked-note-pin" aria-hidden="true" />
                  <div className="linked-note-meta">
                    <span>{note.category}</span>
                    <time dateTime={note.updated_at}>{formatDate(note.updated_at)}</time>
                  </div>
                  <h4>{note.title}</h4>
                  <p>{note.content}</p>
                  <div className="linked-note-actions">
                    <button type="button" onClick={() => startEditing(note)}>Edit</button>
                    <button type="button" onClick={() => handleDelete(note)} disabled={deletingId === note.id}>
                      {deletingId === note.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default LinkedNotesPanel;
