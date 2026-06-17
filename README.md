# zapros

A small, ergonomic HTTP client built on the Web `fetch` standard.

- Zero dependencies — wraps the platform `fetch`.
- Works in Node 18+, Deno, Bun, and the browser.
- Typed responses, JSON-by-default, sensible header merging.
- `baseURL` and per-request `timeout` support.
- Throws a typed `ZaprosError` on non-2xx, timeout, abort, and network failures.

## Install

```bash
# npm
npm install zapros

# pnpm / yarn / bun
pnpm add zapros
yarn add zapros
bun add zapros

# JSR (Deno, Bun, Node)
deno add jsr:@dragonsmako/zapros
npx jsr add @dragonsmako/zapros
```

## Usage

```ts
import zapros from "zapros";

type User = { id: number; name: string };

// GET — returns parsed JSON, typed
const { data, status } = await zapros.get<User>("https://api.example.com/users/1");

// POST with a JSON body — Content-Type is set for you
await zapros.post("https://api.example.com/users", { name: "Ada" });

// PUT / PATCH / DELETE behave as you'd expect
await zapros.patch<User>("https://api.example.com/users/1", { name: "Ada L." });
await zapros.delete("https://api.example.com/users/1");
```

### Setting defaults

`zapros.defaults` is applied to every request. Per-request config wins on conflict.

```ts
zapros.defaults = {
  baseURL: "https://api.example.com",
  headers: { Authorization: "Bearer …", "X-App": "myapp" },
  credentials: "include",
};

// now URLs can be relative to the baseURL
await zapros.get("/users/1");
```

`baseURL` may also be set per-request and is prepended to the `url` as-is.

### Timeouts

Set `timeout` (milliseconds) per request or in `defaults`. When it elapses the
request is aborted and rejects with a `ZaprosError` whose `code` is `ERR_TIMEOUT`.

```ts
await zapros.get("https://api.example.com/slow", { timeout: 5_000 });
```

### Aborting a request

A `timeout` and your own `signal` work together — whichever fires first wins.

```ts
const controller = new AbortController();
document.querySelector("#cancel")?.addEventListener("click", () => controller.abort());

await zapros.get("https://api.example.com/slow", { signal: controller.signal });
```

### Error handling

Every failure rejects with a `ZaprosError`. Its `code` tells you what went wrong,
and HTTP errors also carry the status and parsed response body.

```ts
import zapros, { ZaprosError } from "zapros";

try {
  await zapros.get("https://api.example.com/missing");
} catch (err) {
  if (err instanceof ZaprosError) {
    switch (err.code) {
      case "ERR_HTTP":    console.error(err.status, err.data); break; // e.g. 404, { message }
      case "ERR_TIMEOUT": console.error("timed out"); break;
      case "ERR_ABORTED": console.error("aborted by caller"); break;
      case "ERR_NETWORK": console.error("network failure", err.cause); break;
    }
  }
}
```

## API

### `zapros.get<T>(url, config?)`
### `zapros.delete<T>(url, config?)`
### `zapros.post<T>(url, data?, config?)`
### `zapros.put<T>(url, data?, config?)`
### `zapros.patch<T>(url, data?, config?)`

All return `Promise<ZaprosResult<T>>`:

```ts
type ZaprosResult<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
};
```

### `ZaprosConfig`

```ts
type ZaprosConfig = {
  headers?: Record<string, string>;
  credentials?: "include" | "same-origin" | "omit";
  signal?: AbortSignal;
  timeout?: number;   // milliseconds
  baseURL?: string;
};
```

### `ZaprosError`

```ts
class ZaprosError<T = unknown> extends Error {
  code: "ERR_HTTP" | "ERR_TIMEOUT" | "ERR_ABORTED" | "ERR_NETWORK";
  url: string;
  method: string;
  status?: number;        // ERR_HTTP only
  statusText?: string;    // ERR_HTTP only
  data?: T;               // ERR_HTTP only — parsed error body
  response?: Response;    // ERR_HTTP only
  cause?: unknown;        // underlying error for timeout/abort/network
}
```
#### TODO
- Expand error handling (401, 403, 404, 410, 409, 422, 429)


### Body handling

- Native `fetch` body types — `string`, `FormData`, `URLSearchParams`, `Blob`,
  `ArrayBuffer`, typed arrays, `ReadableStream` — are sent as-is; no `Content-Type`
  is forced, so `fetch` can set the right one (e.g. the multipart boundary for `FormData`).
- Any other value is `JSON.stringify`'d and `Content-Type: application/json` is set unless you override it.
- `null` is sent as the JSON literal `null`; `undefined` sends no body.
- Responses with `content-type: application/json` are parsed as JSON; everything else is returned as text.

## License

[ISC](./LICENSE) © Rafael Rosenhof
