import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zapros from "../src/zapros.ts";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init.headers as Record<string, string> | undefined),
        },
    });
}

function textResponse(body: string, init: ResponseInit = {}): Response {
    return new Response(body, {
        status: 200,
        ...init,
        headers: {
            "content-type": "text/plain",
            ...(init.headers as Record<string, string> | undefined),
        },
    });
}

let fetchMock: FetchMock;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    zapros.defaults = {};
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("zapros - request methods", () => {
    it("sends a GET request without body", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ hello: "world" }));

        const result = await zapros.get<{ hello: string }>("https://api.test/users");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe("https://api.test/users");
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        expect(result.data).toEqual({ hello: "world" });
    });

    it("sends a DELETE request without body", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

        await zapros.delete("https://api.test/users/1");

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.method).toBe("DELETE");
        expect(init.body).toBeUndefined();
    });

    it.each([
        ["post", "POST"],
        ["put", "PUT"],
        ["patch", "PATCH"],
    ] as const)("sends a %s request with JSON body and default Content-Type", async (method, expectedMethod) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));

        await zapros[method]("https://api.test/users", { name: "Ada" });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.method).toBe(expectedMethod);
        expect(init.body).toBe(JSON.stringify({ name: "Ada" }));
        expect(init.headers["Content-Type"]).toBe("application/json");
    });

    it("does not set a body when data is undefined on POST", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.post("https://api.test/ping");

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.body).toBeUndefined();
        expect(init.headers["Content-Type"]).toBeUndefined();
    });

    it("serializes null bodies (null is not undefined)", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.post("https://api.test/x", null);

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.body).toBe("null");
        expect(init.headers["Content-Type"]).toBe("application/json");
    });
});

describe("zapros - response handling", () => {
    it("parses JSON response when content-type is application/json", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ a: 1 }, { status: 201, statusText: "Created" }));

        const result = await zapros.get<{ a: number }>("https://api.test/r");

        expect(result.data).toEqual({ a: 1 });
        expect(result.status).toBe(201);
        expect(result.statusText).toBe("Created");
        expect(result.headers).toBeInstanceOf(Headers);
        expect(result.headers.get("content-type")).toContain("application/json");
    });

    it("returns text body when content-type is not JSON", async () => {
        fetchMock.mockResolvedValueOnce(textResponse("plain text body"));

        const result = await zapros.get<string>("https://api.test/r");

        expect(result.data).toBe("plain text body");
    });

    it("returns text body when content-type header is missing", async () => {
        fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));

        const result = await zapros.get<string>("https://api.test/empty");

        expect(result.data).toBe("");
        expect(result.status).toBe(200);
    });

    it("handles JSON content-type with charset suffix", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "content-type": "application/json; charset=utf-8" },
            }),
        );

        const result = await zapros.get<{ ok: boolean }>("https://api.test/r");

        expect(result.data).toEqual({ ok: true });
    });

    it("throws when response is not ok", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response("nope", { status: 500, statusText: "Internal Server Error" }),
        );

        await expect(zapros.get("https://api.test/err")).rejects.toThrow(
            "Request failed: 500 Internal Server Error",
        );
    });

    it("throws on a 404 without consuming the body", async () => {
        fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404, statusText: "Not Found" }));

        await expect(zapros.get("https://api.test/missing")).rejects.toThrow(
            "Request failed: 404 Not Found",
        );
    });
});

describe("zapros - headers and config", () => {
    it("merges defaults.headers and config.headers (config wins)", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        zapros.defaults = {
            headers: { "X-App": "zapros", "X-Override": "default" },
        };

        await zapros.get("https://api.test/h", {
            headers: { "X-Override": "custom", Authorization: "Bearer t" },
        });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.headers).toEqual({
            "X-App": "zapros",
            "X-Override": "custom",
            Authorization: "Bearer t",
        });
    });

    it("does not overwrite a user-provided Content-Type", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.post("https://api.test/h", { a: 1 }, {
            headers: { "Content-Type": "application/vnd.api+json" },
        });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.headers["Content-Type"]).toBe("application/vnd.api+json");
        expect(init.body).toBe(JSON.stringify({ a: 1 }));
    });

    it("omits credentials when neither defaults nor config set it", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.get("https://api.test/c");

        const [, init] = fetchMock.mock.calls[0]!;
        expect("credentials" in init).toBe(false);
    });

    it("respects per-request credentials override", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.get("https://api.test/c", { credentials: "omit" });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.credentials).toBe("omit");
    });

    it("respects defaults.credentials when no per-request value is set", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        zapros.defaults = { credentials: "same-origin" };

        await zapros.get("https://api.test/c");

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.credentials).toBe("same-origin");
    });

    it("per-request credentials override defaults.credentials", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        zapros.defaults = { credentials: "include" };

        await zapros.get("https://api.test/c", { credentials: "omit" });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.credentials).toBe("omit");
    });

    it("forwards an AbortSignal", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        const controller = new AbortController();

        await zapros.get("https://api.test/s", { signal: controller.signal });

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.signal).toBe(controller.signal);
    });

    it("omits the signal key when no signal is provided", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.get("https://api.test/s");

        const [, init] = fetchMock.mock.calls[0]!;
        expect("signal" in init).toBe(false);
    });

    it("propagates fetch rejection (e.g. aborted request)", async () => {
        const abortErr = new DOMException("The operation was aborted.", "AbortError");
        fetchMock.mockRejectedValueOnce(abortErr);

        await expect(zapros.get("https://api.test/s")).rejects.toBe(abortErr);
    });
});
