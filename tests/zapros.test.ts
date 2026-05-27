import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zapros from "../src/zapros.ts";
import { ZaprosError } from "../src/error.ts";

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

    it("captures the error body on a 404", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response("missing", { status: 404, statusText: "Not Found", headers: { "content-type": "text/plain" } }),
        );

        const err = await zapros.get("https://api.test/missing").catch((e) => e);
        expect(err).toBeInstanceOf(ZaprosError);
        expect(err.message).toBe("Request failed: 404 Not Found");
        expect(err.data).toBe("missing");
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

    it("wraps a fetch abort as ZaprosError with code ERR_ABORTED", async () => {
        const abortErr = new DOMException("The operation was aborted.", "AbortError");
        fetchMock.mockRejectedValueOnce(abortErr);

        const err = await zapros.get("https://api.test/s").catch((e) => e);
        expect(err).toBeInstanceOf(ZaprosError);
        expect(err.code).toBe("ERR_ABORTED");
        expect(err.cause).toBe(abortErr);
    });

    it("prepends config.baseURL to the request URL", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.get("/users", { baseURL: "https://api.test" });

        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe("https://api.test/users");
    });

    it("falls back to defaults.baseURL", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        zapros.defaults = { baseURL: "https://api.test" };

        await zapros.get("/users");

        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe("https://api.test/users");
    });
});

describe("zapros - request body variety", () => {
    it.each([
        ["FormData", () => { const f = new FormData(); f.append("a", "1"); return f; }],
        ["URLSearchParams", () => new URLSearchParams({ a: "1" })],
        ["Blob", () => new Blob(["hi"], { type: "text/plain" })],
        ["ArrayBuffer", () => new ArrayBuffer(8)],
        ["Uint8Array", () => new Uint8Array([1, 2, 3])],
    ] as const)("passes %s through untouched and sets no Content-Type", async (_label, make) => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));
        const body = make();

        await zapros.post("https://api.test/upload", body);

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.body).toBe(body);
        expect(init.headers["Content-Type"]).toBeUndefined();
    });

    it("sends a string body as-is without forcing JSON", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.post("https://api.test/raw", "plain string");

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.body).toBe("plain string");
        expect(init.headers["Content-Type"]).toBeUndefined();
    });

    it("still JSON-encodes plain objects and arrays", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await zapros.post("https://api.test/json", [1, 2, 3]);

        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.body).toBe("[1,2,3]");
        expect(init.headers["Content-Type"]).toBe("application/json");
    });
});

describe("zapros - timeout", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function abortableFetch() {
        return vi.fn((_url: string, init: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
            }),
        );
    }

    it("rejects with ERR_TIMEOUT once the timeout elapses", async () => {
        fetchMock = abortableFetch();
        vi.stubGlobal("fetch", fetchMock);

        const promise = zapros.get("https://api.test/slow", { timeout: 1000 });
        const expectation = expect(promise).rejects.toMatchObject({
            name: "ZaprosError",
            code: "ERR_TIMEOUT",
        });
        await vi.advanceTimersByTimeAsync(1000);
        await expectation;
    });

    it("clears the timer when the response arrives first", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

        const result = await zapros.get("https://api.test/fast", { timeout: 1000 });

        expect(result.data).toEqual({ ok: true });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts via the caller's signal before the timeout (ERR_ABORTED)", async () => {
        fetchMock = abortableFetch();
        vi.stubGlobal("fetch", fetchMock);
        const controller = new AbortController();

        const promise = zapros.get("https://api.test/slow", { timeout: 10_000, signal: controller.signal });
        const expectation = expect(promise).rejects.toMatchObject({ code: "ERR_ABORTED" });
        controller.abort();
        await expectation;
    });
});

describe("ZaprosError", () => {
    it("is thrown with full HTTP context on a non-2xx JSON response", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ message: "boom" }, { status: 422, statusText: "Unprocessable Entity" }),
        );

        const err = await zapros.post("https://api.test/items", { x: 1 }).catch((e) => e);

        expect(err).toBeInstanceOf(ZaprosError);
        expect(err.code).toBe("ERR_HTTP");
        expect(err.status).toBe(422);
        expect(err.statusText).toBe("Unprocessable Entity");
        expect(err.data).toEqual({ message: "boom" });
        expect(err.url).toBe("https://api.test/items");
        expect(err.method).toBe("POST");
        expect(err.response).toBeInstanceOf(Response);
    });

    it("wraps a network failure as ERR_NETWORK preserving the cause", async () => {
        const netErr = new TypeError("Failed to fetch");
        fetchMock.mockRejectedValueOnce(netErr);

        const err = await zapros.get("https://api.test/down").catch((e) => e);

        expect(err).toBeInstanceOf(ZaprosError);
        expect(err.code).toBe("ERR_NETWORK");
        expect(err.cause).toBe(netErr);
        expect(err.status).toBeUndefined();
    });
});
