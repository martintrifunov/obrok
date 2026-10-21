import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { useAuthStore } from "@/store/authStore";
import MapSettingsMenu from "./MapSettingsMenu";

const renderMenu = (props = {}) =>
  renderWithProviders(
    <MapSettingsMenu
      visibleChains={new Set(["Vero"])}
      onToggleChain={vi.fn()}
      {...props}
    />,
  );

const tokenFor = (role) =>
  ["header", btoa(JSON.stringify({ UserInfo: { username: "ana", role } })).replace(/=+$/, ""), "sig"].join(".");

const actionLabels = () =>
  screen
    .getAllByRole("button", { hidden: true })
    .map((b) => b.getAttribute("aria-label"))
    .filter((label) => label && label !== "Поставки");

beforeEach(() => {
  useAuthStore.setState({ auth: {} });
});

describe("MapSettingsMenu", () => {
  it("shows theme, filter and login actions for guests", () => {
    renderMenu();
    expect(actionLabels()).toEqual(["Промени тема", "Филтрирај маркети", "Најава"]);
  });

  it("shows dashboard, theme, filter and logout actions for admins", () => {
    useAuthStore.setState({ auth: { accessToken: tokenFor("admin") } });
    renderMenu();
    expect(actionLabels()).toEqual([
      "Контролна табла",
      "Промени тема",
      "Филтрирај маркети",
      "Одјава",
    ]);
  });

  it("hides the dashboard from logged-in users who aren't admins", () => {
    useAuthStore.setState({ auth: { accessToken: tokenFor("user") } });
    renderMenu();
    expect(actionLabels()).toEqual(["Промени тема", "Филтрирај маркети", "Одјава"]);
  });

  it("lists chains in the filter with their visibility and toggles them", async () => {
    const onToggleChain = vi.fn();
    renderMenu({ onToggleChain });

    await userEvent.click(screen.getByLabelText("Поставки"));
    await userEvent.click(screen.getByLabelText("Филтрирај маркети"));

    const vero = screen.getByRole("checkbox", { name: "Vero" });
    const kam = screen.getByRole("checkbox", { name: "KAM" });
    expect(vero).toHaveAttribute("aria-checked", "true");
    expect(kam).toHaveAttribute("aria-checked", "false");

    await userEvent.click(kam);
    expect(onToggleChain).toHaveBeenCalledWith("KAM");
  });
});
