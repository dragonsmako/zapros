import type {Zapros, ZaprosConfig, ZaprosResult} from "./types";

const zapros: Zapros = {
    get: <T = any>(url: string, config?: ZaprosConfig) => {
        fetch(url)
            .then(async (res) => {
                if (!res.ok) throw new Error();
                return await res.json() as T;
            })

        return {} as ZaprosResult<T>;
    },
    post: <T = any>(url: string, data: {}, config?: {}) => {
        return {} as ZaprosResult<T>;
    },
    put: <T = any>(url: string, data: {}, config?: {}) => {
        return {} as ZaprosResult<T>;
    },
    patch: <T = any>(url: string, data: {}, config?: {}) => {
        return {} as ZaprosResult<T>;
    },
    delete: <T = any>(url: string, data: {}, config?: {}) => {
        return {} as ZaprosResult<T>;
    },
    headers: {
        credentials: "include"
    }
};

export default zapros;