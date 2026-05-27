/**
 * The zapros HTTP client interface.
 *
 * Each method issues a request built on the platform `fetch`, parses the
 * response body (JSON when the `content-type` says so, otherwise text), and
 * resolves to a {@link ZaprosResult}. Non-2xx responses reject with an `Error`.
 *
 * @example
 * ```ts
 * import zapros from "@dragonsmako/zapros";
 *
 * const { data } = await zapros.get<{ id: number }>("https://api.example.com/me");
 * ```
 */
export type Zapros = {
    /**
     * Issue a `GET` request and resolve with the parsed response.
     *
     * @typeParam T - Expected shape of the response body.
     * @param url - Absolute or relative request URL.
     * @param config - Per-request overrides merged over {@link Zapros.defaults}.
     */
    get:    <T = unknown>(url: string, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    /**
     * Issue a `POST` request with an optional JSON body.
     *
     * @typeParam T - Expected shape of the response body.
     * @param url - Absolute or relative request URL.
     * @param data - Value serialized to JSON and sent as the request body.
     * @param config - Per-request overrides merged over {@link Zapros.defaults}.
     */
    post:   <T = unknown>(url: string, data?: unknown, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    /**
     * Issue a `PUT` request with an optional JSON body.
     *
     * @typeParam T - Expected shape of the response body.
     * @param url - Absolute or relative request URL.
     * @param data - Value serialized to JSON and sent as the request body.
     * @param config - Per-request overrides merged over {@link Zapros.defaults}.
     */
    put:    <T = unknown>(url: string, data?: unknown, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    /**
     * Issue a `PATCH` request with an optional JSON body.
     *
     * @typeParam T - Expected shape of the response body.
     * @param url - Absolute or relative request URL.
     * @param data - Value serialized to JSON and sent as the request body.
     * @param config - Per-request overrides merged over {@link Zapros.defaults}.
     */
    patch:  <T = unknown>(url: string, data?: unknown, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    /**
     * Issue a `DELETE` request and resolve with the parsed response.
     *
     * @typeParam T - Expected shape of the response body.
     * @param url - Absolute or relative request URL.
     * @param config - Per-request overrides merged over {@link Zapros.defaults}.
     */
    delete: <T = unknown>(url: string, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    /** Defaults applied to every request; per-call `config` is merged on top. */
    defaults: ZaprosConfig
}

/**
 * The resolved value of a successful zapros request.
 *
 * @typeParam T - Type of the parsed response body.
 */
export type ZaprosResult<T> = {
    /** Parsed response body — JSON-decoded, or raw text for non-JSON responses. */
    data: T;
    /** HTTP status code (always 2xx, since other statuses reject). */
    status: number;
    /** HTTP status text that accompanies {@link ZaprosResult.status}. */
    statusText: string;
    /** Response headers as returned by `fetch`. */
    headers: Headers;
}

/**
 * Per-request configuration. Values set here override {@link Zapros.defaults}.
 */
export type ZaprosConfig = {
    /** Headers merged over the defaults; `Content-Type` is set automatically for JSON bodies. */
    headers?: Record<string, string>;
    /** Credentials mode passed through to `fetch`. Defaults to `"include"`. */
    credentials?: "include" | "same-origin" | "omit";
    /** Signal used to abort the underlying `fetch`. */
    signal?: AbortSignal;
    /** Request timeout in milliseconds. */
    timeout?: number
    /** Base URL for the HTTP Request*/
    baseURL?: string;
}
