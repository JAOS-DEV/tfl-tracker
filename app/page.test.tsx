import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: (key: string, initialValue: unknown) => {
    void key;
    return [initialValue, vi.fn(), true] as const;
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
  it("renders the main dashboard heading", () => {
    renderHomePage();

    expect(
      screen.getByRole("heading", { name: /London Bus Tracker/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Discover routes & stops/i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by TfL Open Data/i)).toBeInTheDocument();
  });
});
