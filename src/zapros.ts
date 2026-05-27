import type { Zapros, ZaprosConfig, ZaprosResult } from "./types.ts";
import { ZaprosError } from "./error.ts";

// Body types fetch can send as-is; anything else is treated as JSON.
function isRawBody(data: unknown): data is BodyInit {
    return (
        typeof data === "string" ||
        data instanceof FormData ||
        data instanceof URLSearchParams ||
        data instanceof Blob ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) ||
        data instanceof ReadableStream
    );
}

// Parse a response body as JSON when it claims to be, otherwise as text.
async function parseBody(res: Response): Promise<unknown> {
    const contentType = res.headers.get("content-type") ?? "";
    return contentType.includes("application/json") ? await res.json() : await res.text();
}

async function request<T>(
    method: string,
    url: string,
    data: unknown,
    config: ZaprosConfig = {},
    defaults: ZaprosConfig = { credentials: "include" },
): Promise<ZaprosResult<T>> {
    const headers = { ...defaults.headers, ...config.headers };
    const credentials = config.credentials ?? defaults.credentials;
    const timeout = config.timeout ?? defaults.timeout;
    const userSignal = config.signal;

    // Combine an optional timeout with an optional caller signal: either one
    // aborts the request. The timer is cleared in `finally` so a fast response
    // doesn't leave a pending timeout holding the event loop open.
    let signal = userSignal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    if (timeout !== undefined) {
        const controller = new AbortController();
        signal = controller.signal;
        timer = setTimeout(() => {
            timedOut = true;
            controller.abort(new DOMException("Request timed out", "TimeoutError"));
        }, timeout);
        if (userSignal) {
            if (userSignal.aborted) controller.abort(userSignal.reason);
            else userSignal.addEventListener("abort", () => controller.abort(userSignal.reason), { once: true });
        }
    }

    const init: RequestInit = {
        method,
        headers,
        ...(credentials !== undefined && { credentials }),
        ...(signal !== undefined && { signal }),
    };

    if (data !== undefined) {
        if (isRawBody(data)) {
            // Pass through untouched so fetch can set the right Content-Type
            // (e.g. the multipart boundary for FormData).
            init.body = data;
        } else {
            init.body = JSON.stringify(data);
            if (!headers["Content-Type"]) {
                headers["Content-Type"] = "application/json";
            }
        }
    }

    const baseURL = config.baseURL ?? defaults.baseURL ?? "";
    const fullUrl = baseURL + url;

    let res: Response;
    try {
        res = await fetch(fullUrl, init);
    } catch (err) {
        if (timedOut) {
            throw new ZaprosError(`Request to ${fullUrl} timed out after ${timeout}ms`, {
                code: "ERR_TIMEOUT", url: fullUrl, method, cause: err,
            });
        }
        if (err instanceof Error && err.name === "AbortError") {
            throw new ZaprosError(`Request to ${fullUrl} was aborted`, {
                code: "ERR_ABORTED", url: fullUrl, method, cause: err,
            });
        }
        throw new ZaprosError(`Request to ${fullUrl} failed: ${(err as Error).message}`, {
            code: "ERR_NETWORK", url: fullUrl, method, cause: err,
        });
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }

    if (!res.ok) {
        // Capture the error body when present so callers can inspect it.
        let errorData: unknown;
        try {
            errorData = await parseBody(res);
        } catch {
            errorData = undefined;
        }
        throw new ZaprosError<T>(`Request failed: ${res.status} ${res.statusText}`, {
            code: "ERR_HTTP",
            url: fullUrl,
            method,
            status: res.status,
            statusText: res.statusText,
            data: errorData as T,
            response: res,
        });
    }

    return {
        data: (await parseBody(res)) as T,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
    };
}

/**
 * The default zapros client.
 *
 * A ready-to-use {@link Zapros} instance exposing `get`, `post`, `put`,
 * `patch`, and `delete`. Each method builds on the platform `fetch`, sends
 * JSON bodies by default, and rejects on non-2xx responses.
 *
 * @example
 * ```ts
 * import zapros from "@dragonsmako/zapros";
 *
 * type User = { id: number; name: string };
 * const { data, status } = await zapros.get<User>("https://api.example.com/users/1");
 *
 * // Change defaults applied to every request:
 * zapros.defaults.credentials = "same-origin";
 * ```
 */
const zapros: Zapros = {
    get:    (url, config) => request("GET",    url, undefined, config, zapros.defaults),
    post:   (url, data, config) => request("POST",   url, data, config, zapros.defaults),
    put:    (url, data, config) => request("PUT",    url, data, config, zapros.defaults),
    patch:  (url, data, config) => request("PATCH",  url, data, config, zapros.defaults),
    delete: (url, config) => request("DELETE", url, undefined, config, zapros.defaults),
    defaults: { credentials: "include" },
};

export default zapros;