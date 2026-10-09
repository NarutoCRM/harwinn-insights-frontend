import { useEffect, useState } from "react";
import { OUTCOMES, ID_PATTERN, formatDate } from "../lib/api.js";
import { ErrorMessage, Pager } from "./ui.jsx";
function CallbackLinks({ project }) {
  const [copied, setCopied] = useState(""),
    [error, setError] = useState(null);
  const urls = OUTCOMES.map((status) => ({
    status,
    url: `${window.location.origin}/tracking/${encodeURIComponent(project.pid)}/${status}?uid=RESPONDENT_ID&transactionId=TRANSACTION_ID`,
  }));
  return (
    <section className="hi-panel">
      <h2>Outcome links · {project.pid}</h2>
      <p>
        Replace RESPONDENT_ID and TRANSACTION_ID with real values. Keep the
        transaction ID stable for retries. Optional username and inTime query
        fields are supported by the default backend mapping.
      </p>
      <p className="hi-muted">
        These links record an outcome when opened. Preview the outcome design
        below without recording a response.
      </p>
      <ErrorMessage error={error} />
      {urls.map(({ status, url }) => (
        <div className="hi-callback" key={status}>
          <span className={`hi-badge hi-status-${status}`}>{status}</span>
          <code>{url}</code>
          <button
            className="hi-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(status);
                setError(null);
              } catch {
                setError(
                  new Error(
                    "Copy unavailable. Select and copy the link manually.",
                  ),
                );
              }
            }}
          >
            {copied === status ? "Copied" : "Copy"}
          </button>
          <a
            href={`/tracking/${status.toLowerCase()}`}
            target="_blank"
            rel="noreferrer"
          >
            Preview ↗
          </a>
        </div>
      ))}
    </section>
  );
}
export default function Projects({ api }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25),
    [data, setData] = useState(null),
    [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(null),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react/set-state-in-effect -- Each external request must clear its prior loading/error state.
    setBusy(true);
    setError(null);
    api(`/api/projects?page=${page}&pageSize=${pageSize}`, {
      signal: controller.signal,
    }).then(
      (value) => {
        setData(value);
        setBusy(false);
      },
      (err) => {
        if (err.name !== "AbortError") {
          setData(null);
          setError(err);
          setBusy(false);
        }
      },
    );
    return () => controller.abort();
  }, [api, page, pageSize, refresh]);
  async function mutate(path, method, body, message) {
    setSaving(true);
    setError(null);
    setNotice("");
    try {
      const result = await api(path, { method, body });
      setNotice(message);
      setEditing(null);
      setDeleting(null);
      if (selected?.id === editing?.id) setSelected(result);
      if (method === "DELETE" && selected?.id === deleting?.id)
        setSelected(null);
      setRefresh((n) => n + 1);
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    const form = e.currentTarget,
      values = new FormData(form);
    if (
      await mutate(
        "/api/projects",
        "POST",
        { pid: values.get("pid"), name: values.get("name").trim() },
        "Project created.",
      )
    ) {
      form.reset();
      setPage(1);
    }
  }
  return (
    <>
      <div className="hi-page-heading">
        <div>
          <p className="hi-eyebrow">PROJECT MANAGEMENT</p>
          <h1>Projects</h1>
          <p>Provision survey PIDs and manage their availability.</p>
        </div>
        <button
          className="hi-secondary"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={busy || saving}
        >
          Refresh
        </button>
      </div>
      <ErrorMessage error={error} />
      {notice && (
        <p className="hi-success" role="status">
          {notice}
        </p>
      )}
      <section className="hi-panel">
        <h2>Create a project</h2>
        <form className="hi-project-form" onSubmit={create}>
          <label>
            Project PID
            <input
              name="pid"
              pattern={ID_PATTERN}
              maxLength={128}
              required
              placeholder="e.g. HW-2026-001"
            />
          </label>
          <label>
            Project name
            <input
              name="name"
              maxLength={200}
              required
              placeholder="e.g. Consumer habits study"
            />
          </label>
          <button disabled={saving}>
            {saving ? "Saving…" : "Create project"}
          </button>
        </form>
        <p className="hi-muted">
          PID is unique and cannot be changed after creation.
        </p>
      </section>
      <section className="hi-panel hi-data-panel" aria-busy={busy}>
        {!busy && !data && error && <button className="hi-secondary" onClick={() => setRefresh(n => n + 1)}>Retry loading projects</button>}
        {busy ? (
          <p role="status">Loading projects…</p>
        ) : (
          data && (
            <>
              {data.projects.length ? (
                <div className="hi-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>PID</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map((project) => (
                        <tr key={project.id}>
                          <td>{project.pid}</td>
                          <td>{project.name}</td>
                          <td>
                            <span
                              className={`hi-badge ${project.active ? "hi-status-COMPLETE" : "hi-status-TERMINATE"}`}
                            >
                              {project.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>{formatDate(project.createdAt)}</td>
                          <td>
                            <div className="hi-actions">
                              <button
                                className="hi-secondary"
                                disabled={saving}
                                onClick={() => {
                                  setEditing({ ...project });
                                  setDeleting(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="hi-secondary"
                                onClick={() => setSelected(project)}
                              >
                                Outcome links
                              </button>
                              <button
                                className="hi-danger"
                                disabled={saving}
                                onClick={() => {
                                  setDeleting(project);
                                  setEditing(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="hi-empty">
                  <h2>No projects yet</h2>
                  <p>Create your first project to accept survey callbacks.</p>
                </div>
              )}
              <Pager
                page={page}
                pageSize={pageSize}
                count={data.projects.length}
                onPage={setPage}
                onSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                disabled={saving}
              />
            </>
          )
        )}
      </section>
      {editing && (
        <section className="hi-panel">
          <h2>Edit {editing.pid}</h2>
          <form
            className="hi-project-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                `/api/projects/${editing.id}`,
                "PATCH",
                { name: editing.name.trim(), active: editing.active },
                "Project updated.",
              );
            }}
          >
            <label>
              Project name
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                required
                maxLength={200}
              />
            </label>
            <label className="hi-check">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              Accept callbacks
            </label>
            <div className="hi-actions">
              <button disabled={saving}>Save changes</button>
              <button
                type="button"
                className="hi-secondary"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
          <p className="hi-muted">
            Inactive projects reject new callbacks. Existing records remain
            available.
          </p>
        </section>
      )}
      {deleting && (
        <section className="hi-panel hi-delete">
          <h2>Delete {deleting.pid}?</h2>
          <p>
            This permanently removes the project. The backend only allows
            deletion when the project has no tracking records.
          </p>
          <div className="hi-actions">
            <button
              className="hi-danger"
              disabled={saving}
              onClick={() =>
                mutate(
                  `/api/projects/${deleting.id}`,
                  "DELETE",
                  undefined,
                  "Project deleted.",
                )
              }
            >
              Confirm deletion
            </button>
            <button
              className="hi-secondary"
              disabled={saving}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      {selected && <CallbackLinks key={selected.id} project={selected} />}
    </>
  );
}
