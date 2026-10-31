import type { AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alertsApi,
  analyticsApi,
  api,
  createRateStream,
  portfolioApi,
  ratesApi,
  technicalApi,
} from "./api";

function response(data: unknown): AxiosResponse {
  return { data } as AxiosResponse;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("is configured for the versioned REST API", () => {
    expect(api.defaults.baseURL).toBe("/api/v1");
    expect(api.defaults.timeout).toBe(15_000);
    expect(api.defaults.headers["Content-Type"]).toBe("application/json");
  });
});

describe("ratesApi", () => {
  it("unwraps the response payload", async () => {
    vi.spyOn(api, "get").mockResolvedValue(
      response({ pair: "EURUSD", rate: 1.08 }),
    );

    await expect(ratesApi.getSpotRate("EURUSD")).resolves.toEqual({
      pair: "EURUSD",
      rate: 1.08,
    });
  });

  it("requests the spot rate for a pair", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(response({}));

    await ratesApi.getSpotRate("GBPJPY");

    expect(get).toHaveBeenCalledWith("/rates/spot/GBPJPY/");
  });

  it("posts the pairs for a batch spot request", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(response({}));

    await ratesApi.batchSpot(["EURUSD", "USDJPY"]);

    expect(post).toHaveBeenCalledWith("/rates/spot/", {
      pairs: ["EURUSD", "USDJPY"],
    });
  });

  it("filters carry trades by minimum carry, defaulting to none", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(response([]));

    await ratesApi.getCarry();
    await ratesApi.getCarry(25);

    expect(get).toHaveBeenNthCalledWith(1, "/rates/carry/?min_carry_bps=0");
    expect(get).toHaveBeenNthCalledWith(2, "/rates/carry/?min_carry_bps=25");
  });

  it("uses a 100,000 notional for pip values unless told otherwise", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(response({}));

    await ratesApi.getPipValue("EURUSD");
    await ratesApi.getPipValue("EURUSD", 500_000);

    expect(get).toHaveBeenNthCalledWith(
      1,
      "/rates/pip-value/EURUSD/?notional=100000",
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/rates/pip-value/EURUSD/?notional=500000",
    );
  });
});

describe("technicalApi", () => {
  it("joins the pairs into a comma separated query", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(response({}));

    await technicalApi.correlation(["EURUSD", "GBPUSD", "USDJPY"]);

    expect(get).toHaveBeenCalledWith(
      "/technical/correlation/?pairs=EURUSD,GBPUSD,USDJPY&n=60",
    );
  });

  it("analyses a pair over 252 observations by default", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(response({}));

    await technicalApi.analyze("EURUSD");

    expect(get).toHaveBeenCalledWith("/technical/EURUSD/?n=252");
  });
});

describe("portfolioApi", () => {
  it("asks for 99% confidence risk unless told otherwise", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(response({}));

    await portfolioApi.getRisk("p1");
    await portfolioApi.getRisk("p1", 0.95);

    expect(get).toHaveBeenNthCalledWith(
      1,
      "/portfolios/p1/risk/?confidence=0.99",
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/portfolios/p1/risk/?confidence=0.95",
    );
  });

  it("sends a close rate only when one is given", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue(response({}));

    await portfolioApi.closePosition("p1", "pos1");
    await portfolioApi.closePosition("p1", "pos1", 1.1);

    expect(del).toHaveBeenNthCalledWith(1, "/portfolios/p1/positions/pos1/", {
      data: {},
    });
    expect(del).toHaveBeenNthCalledWith(2, "/portfolios/p1/positions/pos1/", {
      data: { close_rate: 1.1 },
    });
  });
});

describe("analyticsApi and alertsApi", () => {
  it("posts the pair and notional for a pip value calculation", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(response({}));

    await analyticsApi.pipValue("EURUSD", 250_000);

    expect(post).toHaveBeenCalledWith("/analytics/pip-value/", {
      pair: "EURUSD",
      notional: 250_000,
    });
  });

  it("deletes an alert by id", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValue(response({}));

    await alertsApi.delete("a1");

    expect(del).toHaveBeenCalledWith("/portfolios/alerts/a1/");
  });
});

describe("createRateStream", () => {
  class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    url: string;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
      this.url = url;
      FakeWebSocket.instances.push(this);
    }
  }

  function open(pair?: string, onError?: (event: Event) => void) {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const onTick = vi.fn();
    const ws = createRateStream(
      pair,
      onTick,
      onError,
    ) as unknown as FakeWebSocket;
    return { ws, onTick };
  }

  it("connects to the same host and upper-cases the pair", () => {
    const { ws } = open("eurusd");
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";

    expect(ws.url).toBe(`${scheme}://${window.location.host}/ws/rates/EURUSD/`);
  });

  it("streams every pair when none is given", () => {
    const { ws } = open();

    expect(ws.url.endsWith("/ws/rates/ALL/")).toBe(true);
  });

  it("forwards tick messages to the callback", () => {
    const { ws, onTick } = open("EURUSD");

    ws.onmessage?.({ data: JSON.stringify({ type: "tick", price: 1.0842 }) });

    expect(onTick).toHaveBeenCalledWith({ type: "tick", price: 1.0842 });
  });

  it("ignores other message types and malformed payloads", () => {
    const { ws, onTick } = open("EURUSD");

    ws.onmessage?.({ data: JSON.stringify({ type: "heartbeat" }) });
    ws.onmessage?.({ data: "not json" });

    expect(onTick).not.toHaveBeenCalled();
  });

  it("only installs an error handler when one is supplied", () => {
    const withoutHandler = open("EURUSD");
    expect(withoutHandler.ws.onerror).toBeNull();

    const handler = vi.fn();
    const withHandler = open("EURUSD", handler);
    expect(withHandler.ws.onerror).toBe(handler);
  });
});
