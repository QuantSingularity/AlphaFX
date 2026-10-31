import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../context/AuthContext";
import Login from "./Login";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const login = vi.fn();

function setAuth(isAuthenticated = false) {
  mockedUseAuth.mockReturnValue({
    login,
    isAuthenticated,
  } as unknown as ReturnType<typeof useAuth>);
}

// Stands in for whatever page the login redirects to.
function Destination() {
  const location = useLocation();
  return <p>arrived at {location.pathname}</p>;
}

function renderLogin(
  entry: string | { pathname: string; state: unknown } = "/login",
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const usernameInput = () => screen.getByPlaceholderText("your_username");
const passwordInput = () => screen.getByPlaceholderText("••••••••");
const submit = () => screen.getByRole("button", { name: "Sign in" });

describe("Login page", () => {
  beforeEach(() => {
    login.mockReset();
    mockedUseAuth.mockReset();
    setAuth();
  });

  it("renders the sign in form", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(usernameInput()).toBeInTheDocument();
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("link", { name: "Create one" }),
    ).toBeInTheDocument();
  });

  it("asks for both fields before calling the API", async () => {
    renderLogin();

    await userEvent.type(usernameInput(), "alice");
    await userEvent.click(submit());

    expect(
      screen.getByText("Please enter your username and password."),
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("logs in with the trimmed username and goes to the dashboard", async () => {
    login.mockResolvedValue(undefined);
    renderLogin();

    await userEvent.type(usernameInput(), "  alice  ");
    await userEvent.type(passwordInput(), "secret");
    await userEvent.click(submit());

    expect(login).toHaveBeenCalledWith("alice", "secret");
    expect(
      await screen.findByText("arrived at /dashboard"),
    ).toBeInTheDocument();
  });

  it("returns the user to the page they were trying to open", async () => {
    login.mockResolvedValue(undefined);
    renderLogin({
      pathname: "/login",
      state: { from: { pathname: "/portfolio" } },
    });

    await userEvent.type(usernameInput(), "alice");
    await userEvent.type(passwordInput(), "secret");
    await userEvent.click(submit());

    expect(
      await screen.findByText("arrived at /portfolio"),
    ).toBeInTheDocument();
  });

  it("shows the error message sent by the server", async () => {
    login.mockRejectedValue({
      response: { data: { detail: "Account locked" } },
    });
    renderLogin();

    await userEvent.type(usernameInput(), "alice");
    await userEvent.type(passwordInput(), "secret");
    await userEvent.click(submit());

    expect(await screen.findByText("Account locked")).toBeInTheDocument();
    expect(screen.queryByText(/arrived at/)).not.toBeInTheDocument();
  });

  it("falls back to a generic message for unexpected errors", async () => {
    login.mockRejectedValue(new Error("network down"));
    renderLogin();

    await userEvent.type(usernameInput(), "alice");
    await userEvent.type(passwordInput(), "secret");
    await userEvent.click(submit());

    expect(
      await screen.findByText("Invalid credentials. Please try again."),
    ).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    renderLogin();
    const field = passwordInput();
    const toggle = within(field.parentElement as HTMLElement).getByRole(
      "button",
    );

    await userEvent.click(toggle);
    expect(field).toHaveAttribute("type", "text");

    await userEvent.click(toggle);
    expect(field).toHaveAttribute("type", "password");
  });

  it("sends an already authenticated user straight to the dashboard", async () => {
    setAuth(true);
    renderLogin();

    expect(
      await screen.findByText("arrived at /dashboard"),
    ).toBeInTheDocument();
  });
});
