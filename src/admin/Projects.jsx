import { useEffect, useRef, useState } from "react";
import { OUTCOMES, ID_PATTERN, formatDate } from "../lib/api.js";
import { ErrorMessage, Pager } from "./ui.jsx";
function CallbackLinks({ project }) {
  const [copied, setCopied] = useState(""),
    [error, setError] = useState(null);
  if (!project.pid)
    return (
      <section className="hi-panel">
        <h2>Outcome links ? {project.name}</h2>
        <p>
          Add a Project ID before sharing tracking links. Existing records
          remain available.
        </p>
      </section>
    );
  const urls = OUTCOMES.map((status) => ({
    status,
    url: `${window.location.origin}/tracking/${encodeURIComponent(project.pid)}/${status}?uid=RESPONDENT_ID&transactionId=TRANSACTION_ID`,
  }));
  return (
    <section className="hi-panel">
      <h2>Outcome links · {project.pid}</h2>
      <p>
        Replace RESPONDENT_ID and TRANSACTION_ID with real values. Keep the
        transaction ID stable for retries and unique per new transaction within
        this project. Opening an unchanged template does not create a new response.
        Optional username and inTime query
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
  const mutationPending = useRef(false);
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
    if (mutationPending.current) return false;
    mutationPending.current = true;
    setSaving(true);
    setError(null);
    setNotice("");
    try {
      const result = await api(path, { method, body });
      setNotice(message);
      setEditing(null);
      setDeleting(null);
      if (selected && editing && selected.id === editing.id)
        setSelected(result);
      if (method === "DELETE" && selected?.id === deleting?.id)
        setSelected(null);
      setRefresh((n) => n + 1);
      return true;
    } catch (err) {
      setError(
        err.status === 409 && method !== "DELETE"
          ? new Error(
              "This Project ID is already in use. Enter a distinct Project ID.",
            )
          : err,
      );
      return false;
    } finally {
      mutationPending.current = false;
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
        { pid: values.get("pid") || null, name: values.get("name").trim() },
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
          <p>Save the Project ID and Project Name supplied by your client.</p>
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
        <h2>Add a project</h2>
        <p>
          Share the agreed platform/tool link with your client. Once they have
          added it to their system, ask for their Project ID and Project Name,
          then save them here. Add each project separately, including projects
          from the same company.
        </p>
        <form className="hi-project-form" onSubmit={create}>
          <label>
            Project ID
            <input
              name="pid"
              pattern={ID_PATTERN}
              maxLength={128}
              disabled={saving}
              placeholder="e.g. HW-2026-001"
            />
          </label>
          <label>
            <span>
              Project Name <span className="text-[#8f0808]">*</span>
            </span>
            <input
              disabled={saving}
              name="name"
              maxLength={200}
              required
              placeholder="e.g. Consumer habits study"
            />
          </label>
          <button disabled={saving}>
            {saving ? "Saving…" : "Add project"}
          </button>
        </form>
        <p className="hi-muted">
          Project ID is optional. When provided, it must be unique. Projects
          from the same company and repeated project names are supported. Add an
          ID before using tracking links.
        </p>
      </section>
      <section className="hi-panel hi-data-panel" aria-busy={busy}>
        {!busy && !data && error && (
          <button
            className="hi-secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Retry loading projects
          </button>
        )}
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
                        <th>Project ID</th>
                        <th>Project Name</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map((project) => (
                        <tr key={project.id}>
                          <td>{project.pid || "Not assigned"}</td>
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
                                  setEditing({
                                    ...project,
                                    pid: project.pid ?? "",
                                  });
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
                  <p>
                    Add the Project ID and Project Name supplied by your client
                    to accept survey callbacks.
                  </p>
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
          <h2>Edit {editing.pid || editing.name}</h2>
          <form
            className="hi-project-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                `/api/projects/${editing.id}`,
                "PATCH",
                {
                  pid: editing.pid || null,
                  name: editing.name.trim(),
                  active: editing.active,
                },
                "Project updated.",
              );
            }}
          >
            <label>
              Project ID
              <input
                value={editing.pid}
                onChange={(e) =>
                  setEditing({ ...editing, pid: e.target.value })
                }
                pattern={ID_PATTERN}
                disabled={saving}
                maxLength={128}
              />
            </label>
            <label>
              Project Name
              <input
                disabled={saving}
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
                disabled={saving}
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
            If you change the Project ID, share the updated outcome links with
            your client; old links stop accepting callbacks. Tracking history
            stays with this project. Inactive projects reject new callbacks.
            Existing records remain available.
          </p>
        </section>
      )}
      {deleting && (
        <section className="hi-panel hi-delete">
          <h2>Delete {deleting.pid || deleting.name}?</h2>
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
