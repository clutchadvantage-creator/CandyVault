import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";
import StatCard from "../components/Cards/StatCard.jsx";
import FilterBar from "../components/Filters/FilterBar.jsx";
import PageIntro from "../components/Header/PageIntro.jsx";

const categories = ["Personal", "Ideas", "Work", "Reminders", "Reference", "Other"];
const defaultFilters = {
  search: "",
  category: "",
  linked_type: "",
  sort: "updated_at:desc",
};

function emptyForm() {
  return { title: "", category: "", content: "", linked_type: null, linked_id: null };
}

function formatDate(value, includeTime = false) {
  if (!value) return "No notes yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

async function responseError(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // Use the friendly fallback when the server did not return JSON.
  }
  return fallback;
}

function Notes() {
  const titleInputRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState({ total_notes: 0, latest_note_date: null });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ ...defaultFilters });

  const fetchNoteData = useCallback(async (signal) => {
    const query = new URLSearchParams();
    if (filters.search.trim()) query.set("search", filters.search.trim());
    if (filters.category) query.set("category", filters.category);
    if (filters.linked_type) query.set("linked_type", filters.linked_type);
    const [sortBy, sortDir] = filters.sort.split(":");
    query.set("sort_by", sortBy);
    query.set("sort_dir", sortDir);

    const [notesResponse, summaryResponse] = await Promise.all([
      apiFetch(`/notes?${query.toString()}`, { signal }),
      apiFetch("/notes/summary", { signal }),
    ]);

    if (!notesResponse.ok || !summaryResponse.ok) {
      throw new Error("The note jar could not be loaded from candyserver.");
    }

    const [noteData, summaryData] = await Promise.all([
      notesResponse.json(),
      summaryResponse.json(),
    ]);

    if (!Array.isArray(noteData)) {
      throw new Error("candyserver returned an invalid notes list.");
    }

    return { noteData, summaryData };
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      try {
        const { noteData, summaryData } = await fetchNoteData(controller.signal);
        setNotes(noteData);
        setSummary(summaryData);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadInitialData();
    return () => controller.abort();
  }, [fetchNoteData]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateFilter(event) {
    const { name, value } = event.target;
    setLoading(true);
    setError("");
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setLoading(true);
    setError("");
    setFilters({ ...defaultFilters });
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  async function refreshNotes() {
    const { noteData, summaryData } = await fetchNoteData();
    setNotes(noteData);
    setSummary(summaryData);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const isEditing = editingId !== null;
    const endpoint = isEditing ? `/notes/${editingId}` : "/notes";

    try {
      const response = await apiFetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error(await responseError(response, "The note could not be saved."));
      }

      resetForm();
      await refreshNotes();
      setSuccess(isEditing ? "Note refreshed with a new candy wrapper!" : "Note added to the candy jar!");
    } catch (requestError) {
      setError(requestError.message || "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(note) {
    setForm({
      title: note.title,
      category: note.category,
      content: note.content,
      linked_type: note.linked_type,
      linked_id: note.linked_id,
    });
    setEditingId(note.id);
    setError("");
    setSuccess("");
    titleInputRef.current?.focus();
  }

  async function handleDelete(note) {
    const confirmed = window.confirm(`Delete "${note.title}" from the note jar? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(note.id);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(`/notes/${note.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await responseError(response, "The note could not be deleted."));
      }
      if (editingId === note.id) resetForm();
      await refreshNotes();
      setSuccess("Note removed from the candy jar.");
    } catch (requestError) {
      setError(requestError.message || "The note could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.linked_type,
    filters.sort !== defaultFilters.sort ? filters.sort : "",
  ].filter(Boolean).length;

  return (
    <>
      <PageIntro
        eyebrow="Idea counter"
        title="Notes"
        description="Capture reminders, bright ideas, and useful details on your own CandyVault note wall."
      />

      <section className="stats-grid notes-summary-grid" aria-label="Notes summary">
        <StatCard label="Total Notes" value={String(summary.total_notes)} detail="Notes in the candy jar" icon="TXT" />
        <StatCard label="Latest Note" value={formatDate(summary.latest_note_date)} detail="Most recently updated" icon="NEW" />
      </section>

      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <label className="filter-field filter-search-field">
          <span>Search</span>
          <input name="search" type="search" value={filters.search} onChange={updateFilter} placeholder="Title, content, category…" />
        </label>
        <label className="filter-field">
          <span>Category</span>
          <select name="category" value={filters.category} onChange={updateFilter}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Note type</span>
          <select name="linked_type" value={filters.linked_type} onChange={updateFilter}>
            <option value="">All notes</option>
            <option value="standalone">Standalone</option>
            <option value="expense">Expense Notes</option>
            <option value="document">Document Notes</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Sort</span>
          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="updated_at:desc">Recently updated</option>
            <option value="updated_at:asc">Least recently updated</option>
            <option value="created_at:desc">Newest created</option>
            <option value="created_at:asc">Oldest created</option>
            <option value="title:asc">Title: A to Z</option>
            <option value="title:desc">Title: Z to A</option>
            <option value="category:asc">Category: A to Z</option>
          </select>
        </label>
      </FilterBar>

      {error && <div className="expense-alert" role="alert">{error}</div>}
      {success && <div className="document-success" role="status">{success}</div>}

      <div className="notes-layout">
        <section className={`panel note-form-panel${editingId !== null ? " editing" : ""}`}>
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{editingId !== null ? "Edit note" : "Add a note"}</h2>
              <p className="panel-subtitle">{editingId !== null ? "Give this note a fresh wrapper." : "Pin a thought to your candy wall."}</p>
            </div>
            <span className="panel-kicker">{editingId !== null ? "Editing" : "Fresh note"}</span>
          </div>

          <form className="note-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Title</span>
              <input ref={titleInputRef} name="title" value={form.title} onChange={updateField} maxLength="255" placeholder="e.g. Weekend reminders" required />
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
              <textarea name="content" value={form.content} onChange={updateField} maxLength="10000" rows="9" placeholder="Write your note here…" required />
              <small className="character-count">{form.content.length.toLocaleString()} / 10,000</small>
            </label>

            <div className="note-form-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId !== null ? "Save changes" : "Add to note jar"}
              </button>
              {editingId !== null && <button className="secondary-button" type="button" onClick={resetForm}>Cancel edit</button>}
            </div>
          </form>
        </section>

        <section className="notes-wall" aria-label="Saved notes">
          <div className="notes-wall-header">
            <div>
              <h2>Your note wall</h2>
              <p>Newest updates float to the top.</p>
            </div>
            <span>{summary.total_notes} notes</span>
          </div>

          {loading ? (
            <div className="notes-loading" role="status">Unfolding your candy-colored notes…</div>
          ) : notes.length === 0 ? (
            <div className="notes-empty-state">
              <span aria-hidden="true">N</span>
              <h3>{activeFilterCount ? "No candy matches that search." : "No notes in the candy jar yet."}</h3>
              <p>{activeFilterCount ? "Try a different note flavor or clear the filters." : "Add your first thought using the note counter."}</p>
            </div>
          ) : (
            <div className="notes-card-grid">
              {notes.map((note, index) => (
                <article className={`note-card note-color-${index % 4}`} key={note.id}>
                  <div className="note-pin" aria-hidden="true" />
                  <div className="note-card-top">
                    <div className="note-badge-group">
                      <span className="note-category">{note.category}</span>
                      <span className={`note-link-badge ${note.linked_type ? `linked-${note.linked_type}` : "standalone"}`}>
                        {note.linked_type === "expense"
                          ? "Expense Note"
                          : note.linked_type === "document"
                            ? "Document Note"
                            : "Standalone"}
                      </span>
                    </div>
                    <time dateTime={note.updated_at}>{formatDate(note.updated_at, true)}</time>
                  </div>
                  <h3>{note.title}</h3>
                  <p>{note.content}</p>
                  <div className="note-card-actions">
                    <button type="button" onClick={() => startEditing(note)}>Edit</button>
                    <button className="note-delete-button" type="button" onClick={() => handleDelete(note)} disabled={deletingId === note.id}>
                      {deletingId === note.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default Notes;
