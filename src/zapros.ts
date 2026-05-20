import type { Zapros, ZaprosConfig, ZaprosResult } from "./types.ts";

async function request<T>(
    method: string,
    url: string,
    data: unknown,
    config: ZaprosConfig = {},
    defaults: ZaprosConfig = { credentials: "include" },
): Promise<ZaprosResult<T>> {
    const headers = { ...defaults.headers, ...config.headers };
    const credentials = config.credentials ?? defaults.credentials;

    const init: RequestInit = {
        method,
        headers,
        ...(credentials !== undefined && { credentials }),
        ...(config.signal !== undefined && { signal: config.signal }),
    };

    if (data !== undefined) {
        init.body = JSON.stringify(data);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
    }

    const res = await fetch(url, init);

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    // Handle empty bodies and non-JSON gracefully
    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

    return {
        data: body as T,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
    };
}

const zapros: Zapros = {
    get:    (url, config) => request("GET",    url, undefined, config, zapros.defaults),
    post:   (url, data, config) => request("POST",   url, data, config, zapros.defaults),
    put:    (url, data, config) => request("PUT",    url, data, config, zapros.defaults),
    patch:  (url, data, config) => request("PATCH",  url, data, config, zapros.defaults),
    delete: (url, config) => request("DELETE", url, undefined, config, zapros.defaults),
    defaults: { credentials: "include" },
};

export default zapros;