import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useAuth } from "./context/AuthContext";

vi.mock("./context/AuthContext", () => ({ useAuth: vi.fn() }));

// The real dashboard pulls in react-query and charts; routing is what is under test.
vi.mock("./pages/Dashboard", () => ({
  default: () => <p>dashboard page</p>,
}));

const mockedUseAuth = vi.mocked(useAuth);

function setAuth(isAuthenticated: boolean) {
  mockedUseAuth.mockReturnValue({
    isAuthenticated,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    user: isAuthenticated
      ? {
          id: "1",
          username: "alice",
          email: "alice@example.com",
          first_name: "Alice",
          last_name: "Trader",
          date_joined: "2026-01-01T00:00:00Z",
          plan: "pro",
        }
      : null,
  } as unknown as ReturnType<typeof useAuth>);
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it("shows the landing page on /", async () => {
    setAuth(false);
    renderAt("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: /institutional/i }),
    ).toBeInTheDocument();
  });

  it("shows the sign in page on /login", async () => {
    setAuth(false);
    renderAt("/login");

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("sends an anonymous visitor from a protected page to the login page", async () => {
    setAuth(false);
    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("dashboard page")).not.toBeInTheDocument();
  });

  it("shows protected pages to an authenticated user", async () => {
    setAuth(true);
    renderAt("/dashboard");

    expect(await screen.findByText("dashboard page")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Welcome back" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the landing page for unknown paths", async () => {
    setAuth(false);
    renderAt("/does-not-exist");

    expect(
      await screen.findByRole("heading", { level: 1, name: /institutional/i }),
    ).toBeInTheDocument();
  });
});
