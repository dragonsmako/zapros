export type Zapros = {
    get: <T = any>(url: string, config?: ZaprosConfig) => ZaprosResult<T>,
    post: <T = any>(url: string, data: {}, config?: ZaprosConfig) => ZaprosResult<T>
    put: <T = any>(url: string, data: {}, config?: ZaprosConfig) => ZaprosResult<T>
    patch: <T = any>(url: string, data: {}, config?: ZaprosConfig) => ZaprosResult<T>
    delete: <T = any>(url: string, data: {}, config?: ZaprosConfig) => ZaprosResult<T>
    headers: ZaprosHTTPHeaders
}

export type ZaprosResult<T> = {
    data: T,
}

export type ZaprosConfig = {
    headers: ZaprosHTTPHeaders
}

export type ZaprosHTTPHeaders = {
    credentials: "include"|"same-origin"|"omit"
}

export type ZaprosRequest = {

}