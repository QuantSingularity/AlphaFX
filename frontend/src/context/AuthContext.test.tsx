import { act, renderHook, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api";
import { AuthProvider, useAuth, type User } from "./AuthContext";

const TOKEN_KEY = "alphafx_token";
const USER_KEY = "alphafx_user";

const user: User = {
  id: "1",
  username: "alice",
  email: "alice@example.com",
  first_name: "Alice",
  last_name: "Trader",
  date_joined: "2026-01-01T00:00:00Z",
  plan: "pro",
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

function response(data: unknown): AxiosResponse {
  return { data } as AxiosResponse;
}

async function renderAuth() {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete api.defaults.headers.common["Authorization"];
});

describe("AuthProvider", () => {
  it("starts unauthenticated when nothing is stored", async () => {
    const { result } = await renderAuth();

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("restores a stored session and sets the Authorization header", async () => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    const { result } = await renderAuth();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("alice");
    expect(result.current.token).toBe("stored-token");
    expect(api.defaults.headers.common["Authorization"]).toBe(
      "Bearer stored-token",
    );
  });

  it("discards a corrupted stored session", async () => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    localStorage.setItem(USER_KEY, "{not valid json");

    const { result } = await renderAuth();

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("logs in, persists the session and sets the Authorization header", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue(response({ token: "new-token", user }));
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.login("alice", "secret");
    });

    expect(post).toHaveBeenCalledWith("/auth/login/", {
      username: "alice",
      password: "secret",
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("alice@example.com");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("new-token");
    expect(JSON.parse(localStorage.getItem(USER_KEY) ?? "{}")).toEqual(user);
    expect(api.defaults.headers.common["Authorization"]).toBe(
      "Bearer new-token",
    );
  });

  it("stays logged out when the login request fails", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new Error("bad credentials"));
    const { result } = await renderAuth();

    await expect(
      act(async () => {
        await result.current.login("alice", "wrong");
      }),
    ).rejects.toThrow("bad credentials");

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("registers a new account and logs it in", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue(response({ token: "reg-token", user }));
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.register({
        username: "alice",
        email: "alice@example.com",
        password: "secret",
      });
    });

    expect(post).toHaveBeenCalledWith("/auth/register/", {
      username: "alice",
      email: "alice@example.com",
      password: "secret",
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("reg-token");
  });

  it("logs out and clears every trace of the session", async () => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const { result } = await renderAuth();

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(api.defaults.headers.common["Authorization"]).toBeUndefined();
  });

  it("updates the profile and keeps the existing token", async () => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const patch = vi
      .spyOn(api, "patch")
      .mockResolvedValue(response({ ...user, first_name: "Alicia" }));
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.updateProfile({ first_name: "Alicia" });
    });

    expect(patch).toHaveBeenCalledWith("/auth/profile/", {
      first_name: "Alicia",
    });
    expect(result.current.user?.first_name).toBe("Alicia");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("stored-token");
  });

  it("sends the old and new password when changing it", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(response({}));
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.changePassword("old-pw", "new-pw");
    });

    expect(post).toHaveBeenCalledWith("/auth/change-password/", {
      old_password: "old-pw",
      new_password: "new-pw",
    });
  });
});

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    // React logs the thrown error; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within AuthProvider",
    );
  });
});
