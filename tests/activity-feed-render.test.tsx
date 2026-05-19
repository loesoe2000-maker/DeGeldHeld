import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import ActivityFeed from "@/components/ActivityFeed";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  document.cookie = "dgh_activity_dismissed=; max-age=0; path=/";
  global.fetch = fetchMock as unknown as typeof fetch;
  cleanup();
});

function mockFetch(items: unknown[]) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("ActivityFeed — v15 DEEL 4", () => {
  it("renders the live-besparingen header after first fetch", async () => {
    mockFetch([]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText(/Live besparingen/i)).toBeTruthy();
    });
  });

  it("renders top 5 items", async () => {
    mockFetch([
      { provider: "KPN", savingsCents: 12000, country: "NL", ageSeconds: 60 },
      { provider: "Eneco", savingsCents: 30000, country: "NL", ageSeconds: 120 },
      { provider: "Vodafone", savingsCents: 8400, country: "NL", ageSeconds: 600 },
      { provider: "Ziggo", savingsCents: 4800, country: "NL", ageSeconds: 1200 },
      { provider: "Bunq", savingsCents: 1500, country: "NL", ageSeconds: 3600 },
      { provider: "extra-overflow", savingsCents: 100, country: "NL", ageSeconds: 7200 },
    ]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText(/KPN/)).toBeTruthy();
      expect(screen.getByText(/Eneco/)).toBeTruthy();
    });
    // The 6th item must NOT render (top 5 only).
    expect(screen.queryByText(/extra-overflow/)).toBeNull();
  });

  it("dismiss button hides the feed + sets the cookie", async () => {
    mockFetch([
      { provider: "KPN", savingsCents: 12000, country: "NL", ageSeconds: 60 },
    ]);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByTestId("activity-feed")).toBeTruthy();
    });
    act(() => {
      screen.getByTestId("activity-dismiss").click();
    });
    await waitFor(() => {
      expect(screen.queryByTestId("activity-feed")).toBeNull();
    });
    expect(document.cookie).toMatch(/dgh_activity_dismissed=1/);
  });

  it("formats age: 30s → '30s geleden'", async () => {
    mockFetch([
      { provider: "KPN", savingsCents: 12000, country: "NL", ageSeconds: 30 },
    ]);
    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText(/30s geleden/)).toBeTruthy());
  });

  it("formats age: 120s → '2 min geleden'", async () => {
    mockFetch([
      { provider: "KPN", savingsCents: 12000, country: "NL", ageSeconds: 120 },
    ]);
    render(<ActivityFeed />);
    await waitFor(() => expect(screen.getByText(/2 min geleden/)).toBeTruthy());
  });

  it("does not render when dismissed-cookie already set", async () => {
    document.cookie = "dgh_activity_dismissed=1; path=/";
    mockFetch([]);
    render(<ActivityFeed />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("activity-feed")).toBeNull();
  });

  it("formats euro amounts with NL locale", async () => {
    mockFetch([
      { provider: "KPN", savingsCents: 124500, country: "NL", ageSeconds: 60 },
    ]);
    render(<ActivityFeed />);
    await waitFor(() => {
      // €1.245 in NL locale (period as thousands separator)
      const node = screen.getByText(/€1\.245/);
      expect(node).toBeTruthy();
    });
  });
});
