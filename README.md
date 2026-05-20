# zapros

A small, ergonomic HTTP client built on the Web `fetch` standard.

- Zero dependencies — wraps the platform `fetch`.
- Works in Node 18+, Deno, Bun, and the browser.
- Typed responses, JSON-by-default, sensible header merging.
- Throws on non-2xx responses so you don't forget to check `res.ok`.

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
  headers: { Authorization: "Bearer …", "X-App": "myapp" },
  credentials: "include",
};
```

### Aborting a request

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await zapros.get("https://api.example.com/slow", { signal: controller.signal });
```

### Error handling

Non-2xx responses throw:

```ts
try {
  await zapros.get("https://api.example.com/missing");
} catch (err) {
  // Error: Request failed: 404 Not Found
}
```

Network failures and aborts propagate the original error from `fetch`.

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
};
```

### Body handling

- If `data` is provided, it is `JSON.stringify`'d and `Content-Type: application/json` is set unless you override it.
- `null` is sent as the JSON literal `null`; `undefined` sends no body.
- Responses with `content-type: application/json` are parsed as JSON; everything else is returned as text.

## License

[ISC](./LICENSE) © Rafael Rosenhof
