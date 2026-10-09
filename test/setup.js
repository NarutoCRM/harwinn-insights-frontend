import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (typeof window !== "undefined") {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  }
});
if (typeof window !== "undefined") window.scrollTo = () => {};
