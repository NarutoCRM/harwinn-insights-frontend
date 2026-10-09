export function ErrorMessage({ error }) {
  return error ? (
    <div className="hi-error" role="alert">
      {error.message || error}
      {error.requestId && <small>Support reference: {error.requestId}</small>}
    </div>
  ) : null;
}
export function Pager({
  page,
  pageSize,
  count,
  total,
  onPage,
  onSize,
  disabled,
}) {
  const next =
    total === undefined ? count === pageSize : page * pageSize < total;
  return (
    <div className="hi-pager">
      <span>
        {total !== undefined ? `${total.toLocaleString()} records · ` : ""}Page{" "}
        {page}
      </span>
      <label>
        Rows{" "}
        <select
          value={pageSize}
          onChange={(e) => onSize(Number(e.target.value))}
          disabled={disabled}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <button
        className="hi-secondary"
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <button
        className="hi-secondary"
        disabled={disabled || !next || page >= 100000}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
