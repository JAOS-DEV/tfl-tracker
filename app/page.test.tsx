import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

let localStorageHydrated = true;

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: (key: string, initialValue: unknown) => {
    void key;
    return [initialValue, vi.fn(), localStorageHydrated] as const;
  },
}));

function renderHomePage(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    cleanup();
    localStorageHydrated = true;
  });

  it("renders the main dashboard heading", () => {
    renderHomePage();

    expect(
      screen.getByRole("heading", { name: /Where's My Bus\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Discover routes & stops/i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by TfL Open Data/i)).toBeInTheDocument();
  });

  it("renders route search before saved local data finishes hydrating", () => {
    localStorageHydrated = false;

    renderHomePage();

    expect(
      screen.getByPlaceholderText(/Search route, stop, or live vehicle on active routes/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Search is ready/i)).toBeInTheDocument();
  });
});
