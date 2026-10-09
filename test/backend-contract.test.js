// @vitest-environment node
import { it, expect, vi } from "vitest";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import {
  request,
  OUTCOMES,
  recordQuery,
  trackingPath,
} from "../src/lib/api.js";
it.skipIf(!process.env.HARWINN_BACKEND_PATH)(
  "frontend client integrates with actual Express backend using isolated in-memory fixtures",
  async () => {
    const { fakeDb, appFor, adminToken } = await import(
      /* @vite-ignore */ pathToFileURL(
        join(process.env.HARWINN_BACKEND_PATH, "test/helpers.js"),
      ).href
    );
    const db = fakeDb();
    await adminToken(db);
    const server = appFor(db).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`,
      realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (path, options) =>
      realFetch(origin + path, options),
    );
    try {
      await expect(request("/api/records")).rejects.toMatchObject({
        status: 401,
      });
      const session = await request("/api/auth/login", {
        method: "POST",
        body: { email: "admin@example.test", password: "test-password-long" },
      });
      const token = session.token;
      expect(await request("/api/auth/me", { token })).toMatchObject({
        email: "admin@example.test",
      });
      const project = await request("/api/projects", {
        token,
        method: "POST",
        body: { pid: "FRONTEND-TEST", name: "Frontend contract study" },
      });
      for (const status of OUTCOMES) {
        const data = await request(
          trackingPath(
            project.pid,
            status,
            `uid=u-${status}&transactionId=tx-${status}&inTime=${encodeURIComponent(new Date(Date.now() - 10000).toISOString())}`,
          ),
        );
        expect(data.status).toBe(status);
        expect(data.record.loiSeconds).toBeGreaterThanOrEqual(10);
        expect(typeof data.record.serial).toBe("string");
      }
      const records = await request(
        `/api/records?${recordQuery({ pid: project.pid, status: "COMPLETE" }, 1, 10)}`,
        { token },
      );
      expect(records.total).toBe(1);
      expect(records.records[0].project.pid).toBe(project.pid);
      await expect(
        request(
          trackingPath(
            project.pid,
            "DISQUALIFY",
            "uid=other&transactionId=tx-COMPLETE",
          ),
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        request(`/api/projects/${project.id}`, { token, method: "DELETE" }),
      ).rejects.toMatchObject({ status: 409, code: "RESOURCE_IN_USE" });
      expect(
        await request(`/api/projects/${project.id}`, {
          token,
          method: "PATCH",
          body: { name: "Updated", active: false },
        }),
      ).toMatchObject({ name: "Updated", active: false, pid: project.pid });
      await expect(
        request(
          trackingPath(project.pid, "COMPLETE", "uid=u&transactionId=new"),
        ),
      ).rejects.toMatchObject({ status: 404 });
      const empty = await request("/api/projects", {
        token,
        method: "POST",
        body: { pid: "EMPTY-TEST", name: "Empty" },
      });
      expect(
        await request(`/api/projects/${empty.id}`, { token, method: "DELETE" }),
      ).toBeNull();
      await request("/api/auth/logout", { token, method: "POST" });
      await expect(request("/api/auth/me", { token })).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      vi.unstubAllGlobals();
      await new Promise((resolve) => server.close(resolve));
    }
  },
  15000,
);
