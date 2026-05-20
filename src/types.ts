export type Zapros = {
    get:    <T = unknown>(url: string, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    post:   <T = unknown>(url: string, data?: unknown, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    put:    <T = unknown>(url: string, data?: unknown, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    patch:  <T = unknown>(url: string, data?: unknown, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    delete: <T = unknown>(url: string, config?: ZaprosConfig) => Promise<ZaprosResult<T>>;
    defaults: ZaprosConfig
}

export type ZaprosResult<T> = {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
}

export type ZaprosConfig = {
    headers?: Record<string, string>;
    credentials?: "include" | "same-origin" | "omit";
    signal?: AbortSignal;
    timeout?: number
}