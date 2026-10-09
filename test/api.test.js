import { describe, it, expect, vi } from "vitest";
import {
  request,
  recordQuery,
  trackingPath,
  readSession,
  saveSession,
  ApiError,
} from "../src/lib/api.js";
describe("API contract", () => {
  it("sends bearer sessions and JSON without leaking tokens into URLs", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "project" }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      await request("/api/projects", {
        token: "secret",
        method: "POST",
        body: { pid: "A", name: "Study" },
      }),
    ).toEqual({ id: "project" });
    expect(fetch.mock.calls[0]).toEqual([
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: '{"pid":"A","name":"Study"}',
      }),
    ]);
  });
  it("supports logout/deletion 204 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(await request("/api/auth/logout", { method: "POST" })).toBeNull();
  });
  it("preserves sanitized backend errors and support request IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                message: "Resource has dependent records",
                code: "RESOURCE_IN_USE",
                requestId: "ref",
              },
            }),
            { status: 409 },
          ),
        ),
    );
    await expect(
      request("/api/projects/a", { method: "DELETE" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "RESOURCE_IN_USE",
      requestId: "ref",
    });
  });
  it("handles network failure and unexpected non-JSON success", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("failed"))
      .mockResolvedValueOnce(new Response("<html/>"));
    vi.stubGlobal("fetch", fetch);
    await expect(request("/api/records")).rejects.toBeInstanceOf(ApiError);
    await expect(request("/api/records")).rejects.toThrow(
      "unexpected response",
    );
  });
  it("preserves aborted requests for effect cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
    );
    await expect(request("/api/records")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
  it("uses only allowed filters and converts local dates to ISO", () => {
    const params = new URLSearchParams(
      recordQuery(
        {
          pid: " A ",
          country: "IN",
          from: "2026-01-01T12:00",
          unknown: "ignored",
        },
        2,
        50,
      ),
    );
    expect(params.get("pid")).toBe("A");
    expect(params.get("from")).toBe(new Date("2026-01-01T12:00").toISOString());
    expect(params.has("unknown")).toBe(false);
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
  });
  it("encodes PID and preserves original callback parameter names/transaction", () => {
    expect(trackingPath("A@B", "COMPLETE", "uid=u&transactionId=t")).toBe(
      "/redirect/A%40B/COMPLETE?uid=u&transactionId=t",
    );
    expect(() => trackingPath("A", "complete")).toThrow("Unknown outcome");
  });
  it("drops malformed/expired sessions and retains valid sessions only for this tab", () => {
    sessionStorage.setItem("harwinn-session", "bad");
    expect(readSession()).toBeNull();
    saveSession({ token: "old", expiresAt: "2000-01-01" });
    expect(readSession()).toBeNull();
    const session = {
      token: "a".repeat(43),
      admin: { email: "admin@example.test" },
      expiresAt: new Date(Date.now() + 100000).toISOString(),
    };
    saveSession({ ...session, admin: null });
    expect(readSession()).toBeNull();
    saveSession(session);
    expect(readSession()).toEqual(session);
    saveSession(null);
    expect(readSession()).toBeNull();
  });
});
