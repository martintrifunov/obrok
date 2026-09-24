import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import ConsentGate from "./ConsentGate";

vi.mock("@/components/ui/TermsAndPrivacyModal", () => ({
  default: ({ onAccept }) => <button onClick={onAccept}>Accept terms</button>,
}));

const blockStorage = () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
};

afterEach(() => vi.restoreAllMocks());

describe("ConsentGate", () => {
  it("shows the app once terms were accepted", () => {
    window.localStorage.setItem("obrok_terms_accepted", "true");
    renderWithProviders(<ConsentGate>app</ConsentGate>);
    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("asks for consent and remembers it", async () => {
    renderWithProviders(<ConsentGate>app</ConsentGate>);
    screen.getByText("Accept terms").click();

    expect(await screen.findByText("app")).toBeInTheDocument();
    expect(window.localStorage.getItem("obrok_terms_accepted")).toBe("true");
  });

  it("still works when site storage is blocked", async () => {
    blockStorage();
    renderWithProviders(<ConsentGate>app</ConsentGate>);

    screen.getByText("Accept terms").click();

    expect(await screen.findByText("app")).toBeInTheDocument();
  });
});
