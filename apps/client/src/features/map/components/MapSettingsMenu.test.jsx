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

  it("shows dashboard, theme, filter and logout actions for logged-in users", () => {
    useAuthStore.setState({ auth: { accessToken: "token" } });
    renderMenu();
    expect(actionLabels()).toEqual([
      "Контролна табла",
      "Промени тема",
      "Филтрирај маркети",
      "Одјава",
    ]);
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
