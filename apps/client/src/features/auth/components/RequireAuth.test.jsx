import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import RequireAuth from "./RequireAuth";

const tokenFor = (role) =>
  ["header", btoa(JSON.stringify({ UserInfo: { username: "ana", role } })).replace(/=+$/, ""), "sig"].join(".");

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>map</p>} />
        <Route path="/login" element={<p>login</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<p>dashboard</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => useAuthStore.setState({ auth: {} }));

describe("RequireAuth", () => {
  it("sends guests to the login page", () => {
    renderAt("/dashboard");
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("lets admins into the dashboard", () => {
    useAuthStore.setState({ auth: { accessToken: tokenFor("admin") } });
    renderAt("/dashboard");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("sends logged-in users who aren't admins back to the map", () => {
    useAuthStore.setState({ auth: { accessToken: tokenFor("user") } });
    renderAt("/dashboard");
    expect(screen.getByText("map")).toBeInTheDocument();
  });
});
