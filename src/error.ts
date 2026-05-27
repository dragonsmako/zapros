/**
 * Classifies why a zapros request failed.
 *
 * - `ERR_HTTP` — the server responded with a non-2xx status.
 * - `ERR_TIMEOUT` — the request exceeded its configured `timeout`.
 * - `ERR_ABORTED` — the caller's `AbortSignal` aborted the request.
 * - `ERR_NETWORK` — `fetch` itself failed (DNS, connection refused, CORS, …).
 */
export type ZaprosErrorCode = "ERR_HTTP" | "ERR_TIMEOUT" | "ERR_ABORTED" | "ERR_NETWORK";

/** Fields used to construct a {@link ZaprosError}. */
export interface ZaprosErrorInit<T = unknown> {
    /** Why the request failed; see {@link ZaprosErrorCode}. */
    code: ZaprosErrorCode;
    /** The full request URL, including any `baseURL`. */
    url: string;
    /** The HTTP method used for the request. */
    method: string;
    /** HTTP status code, present only for `ERR_HTTP`. */
    status?: number;
    /** HTTP status text, present only for `ERR_HTTP`. */
    statusText?: string;
    /** Parsed error response body, present only for `ERR_HTTP`. */
    data?: T;
    /** The raw `Response`, present only for `ERR_HTTP`. */
    response?: Response;
    /** The underlying error that triggered this one, if any. */
    cause?: unknown;
}

/**
 * The error every zapros request rejects with.
 *
 * Carries enough context to handle the failure without re-deriving it: the
 * {@link ZaprosError.code} says *why* it failed, and for HTTP errors the
 * status, status text, parsed body, and raw `Response` are attached.
 *
 * @typeParam T - Type of the parsed error response body (for `ERR_HTTP`).
 *
 * @example
 * ```ts
 * import zapros, { ZaprosError } from "@dragonsmako/zapros";
 *
 * try {
 *   await zapros.get("https://api.example.com/missing");
 * } catch (err) {
 *   if (err instanceof ZaprosError && err.code === "ERR_HTTP") {
 *     console.error(err.status, err.data);
 *   }
 * }
 * ```
 */
export class ZaprosError<T = unknown> extends Error {
    /** Why the request failed; see {@link ZaprosErrorCode}. */
    readonly code: ZaprosErrorCode;
    /** The full request URL, including any `baseURL`. */
    readonly url: string;
    /** The HTTP method used for the request. */
    readonly method: string;
    /** HTTP status code, set only for `ERR_HTTP`. */
    readonly status: number | undefined;
    /** HTTP status text, set only for `ERR_HTTP`. */
    readonly statusText: string | undefined;
    /** Parsed error response body, set only for `ERR_HTTP`. */
    readonly data: T | undefined;
    /** The raw `Response`, set only for `ERR_HTTP`. */
    readonly response: Response | undefined;

    constructor(message: string, init: ZaprosErrorInit<T>) {
        super(message, init.cause !== undefined ? { cause: init.cause } : undefined);
        this.name = "ZaprosError";
        this.code = init.code;
        this.url = init.url;
        this.method = init.method;
        this.status = init.status;
        this.statusText = init.statusText;
        this.data = init.data;
        this.response = init.response;
    }
}
