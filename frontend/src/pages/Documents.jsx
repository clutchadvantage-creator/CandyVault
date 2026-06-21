import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiUrl } from "../api/client.js";
import StatCard from "../components/Cards/StatCard.jsx";
import FolderManager from "../components/Documents/FolderManager.jsx";
import FilterBar from "../components/Filters/FilterBar.jsx";
import PageIntro from "../components/Header/PageIntro.jsx";
import LinkedNotesPanel from "../components/Notes/LinkedNotesPanel.jsx";

const categories = ["Personal", "Financial", "Legal", "Medical", "Receipts", "Work", "Other"];
const defaultFilters = {
  search: "",
  category: "",
  content_type: "",
  folder_id: "",
  sort: "uploaded_at:desc",
};

function emptyForm() {
  return { title: "", category: "", notes: "", folder_id: "" };
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "No uploads yet";
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
    // The fallback below is clearer than a JSON parsing error.
  }
  return fallback;
}

function Documents() {
  const fileInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState({
    total_documents: 0,
    total_storage_bytes: 0,
    latest_upload_date: null,
  });
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filters, setFilters] = useState({ ...defaultFilters });
  const [folders, setFolders] = useState([]);

  const fetchDocumentData = useCallback(async (signal) => {
    const query = new URLSearchParams();
    if (filters.search.trim()) query.set("search", filters.search.trim());
    if (filters.category) query.set("category", filters.category);
    if (filters.content_type) query.set("content_type", filters.content_type);
    if (filters.folder_id) query.set("folder_id", filters.folder_id);
    const [sortBy, sortDir] = filters.sort.split(":");
    query.set("sort_by", sortBy);
    query.set("sort_dir", sortDir);

    const [documentsResponse, summaryResponse, foldersResponse] = await Promise.all([
      apiFetch(`/documents?${query.toString()}`, { signal }),
      apiFetch("/documents/summary", { signal }),
      apiFetch("/document-folders", { signal }),
    ]);

    if (!documentsResponse.ok || !summaryResponse.ok || !foldersResponse.ok) {
      throw new Error("The document shelf could not be loaded from candyserver.");
    }

    const [documentData, summaryData, folderData] = await Promise.all([
      documentsResponse.json(),
      summaryResponse.json(),
      foldersResponse.json(),
    ]);

    if (!Array.isArray(documentData) || !Array.isArray(folderData)) {
      throw new Error("candyserver returned an invalid document list.");
    }

    return { documentData, summaryData, folderData };
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      try {
        const { documentData, summaryData, folderData } = await fetchDocumentData(controller.signal);
        setDocuments(documentData);
        setSummary(summaryData);
        setFolders(folderData);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadInitialData();
    return () => controller.abort();
  }, [fetchDocumentData]);

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

  async function refreshDocuments() {
    const { documentData, summaryData, folderData } = await fetchDocumentData();
    setDocuments(documentData);
    setSummary(summaryData);
    setFolders(folderData);
  }

  async function handleFoldersChanged(deletedFolderId) {
    if (deletedFolderId) {
      if (form.folder_id === String(deletedFolderId)) {
        setForm((current) => ({ ...current, folder_id: "" }));
      }
      if (filters.folder_id === String(deletedFolderId)) {
        setLoading(true);
        setFilters((current) => ({ ...current, folder_id: "" }));
        return;
      }
    }
    await refreshDocuments();
  }

  function handleFolderFeedback(type, message) {
    setError(type === "error" ? message : "");
    setSuccess(type === "success" ? message : "");
  }

  async function handleUpload(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedFile) {
      setError("Choose a document before sending it to the vault.");
      return;
    }

    const uploadData = new FormData();
    uploadData.append("file", selectedFile);
    uploadData.append("title", form.title);
    uploadData.append("category", form.category);
    uploadData.append("notes", form.notes);
    if (form.folder_id) uploadData.append("folder_id", form.folder_id);

    setUploading(true);
    try {
      const response = await apiFetch("/documents/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!response.ok) {
        throw new Error(await responseError(response, "The document could not be uploaded."));
      }

      setForm(emptyForm());
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshDocuments();
      setSuccess("Document tucked safely into the CandyVault jar!");
    } catch (requestError) {
      setError(requestError.message || "The document could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(document) {
    const confirmed = window.confirm(`Remove “${document.title}” from CandyVault? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(document.id);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(`/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await responseError(response, "The document could not be deleted."));
      }
      if (selectedDocument?.id === document.id) setSelectedDocument(null);
      await refreshDocuments();
      setSuccess("Document removed from the candy jar.");
    } catch (requestError) {
      setError(requestError.message || "The document could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.content_type,
    filters.folder_id,
    filters.sort !== defaultFilters.sort ? filters.sort : "",
  ].filter(Boolean).length;

  return (
    <>
      <PageIntro
        eyebrow="Document counter"
        title="Documents"
        description="Upload and organize the important files you want stored safely in CandyVault."
      />

      <section className="stats-grid document-summary-grid" aria-label="Document summary">
        <StatCard label="Total Documents" value={String(summary.total_documents)} detail="Files in the candy jar" icon="DOC" />
        <StatCard label="Storage Used" value={formatFileSize(summary.total_storage_bytes)} detail="Local document storage" icon="MB" />
        <StatCard label="Latest Upload" value={formatDate(summary.latest_upload_date)} detail="Newest vault addition" icon="NEW" />
      </section>

      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <label className="filter-field filter-search-field">
          <span>Search</span>
          <input name="search" type="search" value={filters.search} onChange={updateFilter} placeholder="Title, filename, notes…" />
        </label>
        <label className="filter-field">
          <span>Category</span>
          <select name="category" value={filters.category} onChange={updateFilter}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>File type</span>
          <select name="content_type" value={filters.content_type} onChange={updateFilter}>
            <option value="">All file types</option>
            <option value="application/pdf">PDF</option>
            <option value="image/png">PNG image</option>
            <option value="image/jpeg">JPEG image</option>
            <option value="text/plain">Text file</option>
            <option value="application/msword">Word (.doc)</option>
            <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word (.docx)</option>
            <option value="application/vnd.ms-excel">Excel (.xls)</option>
            <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">Excel (.xlsx)</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Candy jar</span>
          <select name="folder_id" value={filters.folder_id} onChange={updateFilter}>
            <option value="">All folders</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Sort</span>
          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="uploaded_at:desc">Newest upload</option>
            <option value="uploaded_at:asc">Oldest upload</option>
            <option value="title:asc">Title: A to Z</option>
            <option value="title:desc">Title: Z to A</option>
            <option value="category:asc">Category: A to Z</option>
            <option value="file_size:desc">Largest file</option>
            <option value="file_size:asc">Smallest file</option>
          </select>
        </label>
      </FilterBar>

      {error && <div className="expense-alert" role="alert">{error}</div>}
      {success && <div className="document-success" role="status">{success}</div>}

      <FolderManager
        folders={folders}
        onChanged={handleFoldersChanged}
        onFeedback={handleFolderFeedback}
      />

      <div className="document-layout">
        <section className="panel document-form-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Upload a document</h2>
              <p className="panel-subtitle">Accepted files up to 25 MB.</p>
            </div>
            <span className="panel-kicker">Order counter</span>
          </div>

          <form className="document-form" onSubmit={handleUpload}>
            <label className="form-field file-picker-field">
              <span>Document file</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.xls,.xlsx"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                required
              />
              <small>{selectedFile ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}` : "PDF, images, text, Word, or Excel"}</small>
            </label>

            <label className="form-field">
              <span>Title</span>
              <input name="title" value={form.title} onChange={updateField} maxLength="255" placeholder="e.g. Home insurance policy" required />
            </label>

            <label className="form-field">
              <span>Category</span>
              <select name="category" value={form.category} onChange={updateField} required>
                <option value="">Select a category</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>Candy jar / Folder</span>
              <select name="folder_id" value={form.folder_id} onChange={updateField}>
                <option value="">No folder / General Documents</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>Notes</span>
              <textarea name="notes" value={form.notes} onChange={updateField} maxLength="2000" rows="4" placeholder="Optional details about this document" />
            </label>

            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Add to CandyVault"}
            </button>
          </form>
        </section>

        <section className="panel document-list-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Document shelf</h2>
              <p className="panel-subtitle">Newest uploads appear first.</p>
            </div>
            <span className="panel-kicker">{summary.total_documents} stored</span>
          </div>

          {loading ? (
            <div className="expense-state" role="status">Opening the document candy jar…</div>
          ) : documents.length === 0 ? (
            <div className="empty-state document-empty-state">
              <div>
                <div className="empty-state-mark" aria-hidden="true">D</div>
                <h3>{filters.folder_id ? "This candy jar is empty." : activeFilterCount ? "No candy matches that search." : "This candy jar is waiting for its first document."}</h3>
                <p>{activeFilterCount ? "Try another file flavor or clear the filters." : "Use the upload counter to add a file to your personal vault."}</p>
              </div>
            </div>
          ) : (
            <div className="document-table-wrap">
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Folder</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th>Notes</th>
                    <th className="document-actions-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <strong className="document-title">{document.title}</strong>
                        <span className="document-filename">{document.original_filename}</span>
                      </td>
                      <td><span className="category-pill">{document.category}</span></td>
                      <td>
                        <span className={`document-folder-badge${document.folder ? " in-folder" : ""}`}>
                          {document.folder?.name || "General Documents"}
                        </span>
                      </td>
                      <td>{formatFileSize(document.file_size)}</td>
                      <td>{formatDate(document.uploaded_at, true)}</td>
                      <td className="document-notes">{document.notes || "No notes"}</td>
                      <td>
                        <div className="document-actions">
                          <a href={apiUrl(`/documents/${document.id}/view`)} target="_blank" rel="noreferrer">View</a>
                          <a href={apiUrl(`/documents/${document.id}/download`)}>Download</a>
                          <button
                            className="document-notes-button"
                            type="button"
                            onClick={() => setSelectedDocument(document)}
                          >
                            Notes
                          </button>
                          <button type="button" onClick={() => handleDelete(document)} disabled={deletingId === document.id}>
                            {deletingId === document.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedDocument && (
        <LinkedNotesPanel
          key={`document-${selectedDocument.id}`}
          linkedType="document"
          linkedId={selectedDocument.id}
          title={selectedDocument.title}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </>
  );
}

export default Documents;
