import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function setAuth(state: { isAuthenticated: boolean; isLoading: boolean }) {
  mockedUseAuth.mockReturnValue(state as ReturnType<typeof useAuth>);
}

// Shows where the redirect came from, so the test can check the saved location.
function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return <p>login page, came from {from?.pathname}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <p>secret content</p>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it("renders its children for an authenticated user", () => {
    setAuth({ isAuthenticated: true, isLoading: false });
    renderAt("/private");

    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("redirects an anonymous user to the login page and remembers the origin", () => {
    setAuth({ isAuthenticated: false, isLoading: false });
    renderAt("/private");

    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
    expect(
      screen.getByText("login page, came from /private"),
    ).toBeInTheDocument();
  });

  it("shows a loading state while the session is being restored", () => {
    setAuth({ isAuthenticated: false, isLoading: true });
    renderAt("/private");

    expect(screen.getByText("LOADING")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });
});
