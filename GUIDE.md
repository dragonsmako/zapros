# Building `zapros` — an HTTP client for npm + JSR

A focused, opinionated guide to building a small HTTP client that publishes to **npm** (Node.js, Bun, browser-compatible) and **JSR** (Deno + others). The strategy below avoids the most common pitfall: runtime-specific code that locks you into one ecosystem.

---

## 0. Strategic decisions (make these first)

These choices determine everything else. Pick now, don't drift later.

| Decision | Recommendation | Why |
|---|---|---|
| **Core transport** | The platform `fetch` (Web standard) | Native in Node ≥18, Deno, Bun, browsers. Zero polyfill. Works on JSR without shims. |
| **Language** | TypeScript with `strict: true` | JSR rewards explicit types (faster publish, no slow-types warnings). npm consumers expect `.d.ts`. |
| **Module format** | ESM-only source; dual ESM+CJS *output* for npm | JSR is ESM-only. Some npm consumers still need CJS — generate it at build time. |
| **Runtime APIs** | Only use Web standards (`fetch`, `Request`, `Response`, `Headers`, `URL`, `AbortController`, `TextDecoder`, `ReadableStream`) | No `node:` imports in the core. Keeps you Deno- and browser-compatible. |
| **Dependencies** | Zero runtime dependencies | Smaller install, simpler JSR publish, fewer audit headaches. Dev deps are fine. |
| **Package name** | `zapros` on npm, `@yourscope/zapros` on JSR | JSR requires scoped names. Keep them aligned. |

---

## 1. What "easier than axios/fetch" actually means

Before writing code, decide which pain points you're fixing. A short, defensible list beats a kitchen sink. Suggested:

- **Throws on HTTP errors by default** (fetch doesn't; axios does — keep that).
- **JSON in/out by default** — no `await res.json()` two-step. `await client.get(url)` returns parsed body.
- **Cascading config** — `defaults → instance → call-site`, deeply merged for headers, shallow for the rest.
- **Built-in timeout** — `timeout: 5000` instead of wiring `AbortController` manually.
- **Built-in retries with backoff** — opt-in, configurable.
- **Typed responses** — `client.get<User>(url)` returns `Promise<User>`.
- **Lightweight** — no `transformRequest`/`transformResponse` zoo. One middleware/interceptor mechanism, not three.

Keep the surface small. Every feature you add is a future bug.

---

## 2. Bootstrap the project

```bash
cd /home/rafael/Desktop/zapros
git init
npm init -y
```

Then edit `package.json` to look like this (replace fields as needed):

```jsonc
{
  "name": "zapros",
  "version": "0.0.1",
  "description": "A small, ergonomic HTTP client built on the Web fetch standard.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "node": ">=18" },
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "prepublishOnly": "npm run typecheck && npm run test && npm run build"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0",
    "@types/node": "^20.0.0"
  }
}
```

Install dev deps:

```bash
npm install
```

---

## 3. TypeScript config

`tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`lib: ["DOM"]` gives you `fetch`/`Response`/`Headers` types without pulling in Node-specific ones. For JSR, prefer explicit return types on every exported function — it skips JSR's "slow types" inference and makes publishing faster.

---

## 4. Build pipeline (`tsup`)

`tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  treeshake: true,
});
```

This produces `dist/index.js` (ESM), `dist/index.cjs` (CJS), and `dist/index.d.ts`. Both consumers covered.

---

## 5. Source layout

```
src/
  index.ts          // public exports
  client.ts         // createClient(), the Client class/factory
  request.ts        // low-level fetch wrapper
  config.ts         // config merging, defaults
  errors.ts         // HttpError, TimeoutError, NetworkError
  retry.ts          // retry policy
  types.ts          // ClientConfig, RequestConfig, etc.
tests/
  client.test.ts
  retry.test.ts
  errors.test.ts
```

Keep `index.ts` as a thin re-export surface. Everything else stays internal until you need to expose it.

---

## 6. Minimal API sketch (the user-facing shape)

```ts
import { createClient } from "zapros";

const api = createClient({
  baseUrl: "https://api.example.com",
  headers: { authorization: `Bearer ${token}` },
  timeout: 5000,
  retry: { attempts: 3, backoff: "exponential" },
});

const user = await api.get<User>("/users/42");
const created = await api.post<User>("/users", { body: { name: "Ada" } });
```

Internally, every method (`get`, `post`, `put`, `patch`, `delete`) funnels into one `request()` that:

1. Merges defaults + per-call config.
2. Builds a `Request` (URL join, headers, JSON-stringified body).
3. Wraps the `fetch` call with an `AbortController` for the timeout.
4. Runs through interceptors (request → fetch → response).
5. Throws `HttpError` on non-2xx.
6. Auto-parses JSON (or returns raw `Response` if `raw: true`).
7. Retries per policy on transient failures (network errors, 5xx, 429 with `Retry-After`).

Don't ship interceptors until you've used the client yourself for a week — half the time you don't actually need them.

---

## 7. Testing

Vitest works out of the box and runs the same tests Deno can later run (with minor tweaks). Mock `fetch` directly with `vi.spyOn(globalThis, "fetch")` — no need for `msw` or `nock` unless your test scope grows.

Cover at least:
- Happy path for each method.
- 4xx and 5xx throw `HttpError` with status, body, headers preserved.
- Timeout fires `TimeoutError`, not a generic abort.
- Retry respects `attempts` and stops on success.
- Header merging: instance headers + call-site headers, with call-site winning.
- `baseUrl` join correctness (trailing slash, absolute URL on the call-site).

---

## 8. Publishing to npm

```bash
# one-time
npm login

# every release
npm version patch        # or minor / major — bumps package.json and tags git
npm publish --access public
git push --follow-tags
```

The `prepublishOnly` script in §2 makes sure you don't publish a broken build.

If the name `zapros` is taken on npm, scope it: `@r-rosenhof/zapros`. Scoped packages need `--access public` on first publish.

---

## 9. Adding JSR support

JSR publishes **source TypeScript**, not built JS — no bundler step. You just need a manifest.

`jsr.json` (or add `"name"`, `"version"`, `"exports"` to `deno.json`):

```jsonc
{
  "name": "@yourscope/zapros",
  "version": "0.0.1",
  "exports": "./src/index.ts",
  "publish": {
    "include": ["src", "README.md", "LICENSE"],
    "exclude": ["**/*.test.ts"]
  }
}
```

Rules JSR enforces (catch them early):

- **No `node:` imports** in published files. If you need Node-only paths later, isolate them behind a separate entry point not listed in `exports`.
- **Explicit return types** on every exported function and method. Avoids "slow types" — JSR will publish either way, but slow types means consumers don't get the pre-computed `.d.ts` and your package feels slower.
- **No bare specifiers** that aren't in `package.json` `dependencies` — JSR maps them through `imports` or expects `npm:`/`jsr:` specifiers. Since you're zero-dep, this is a non-issue.
- **File extensions in relative imports**: `import { foo } from "./bar.ts"` — yes, with the `.ts`. JSR requires it. (TypeScript accepts it with `moduleResolution: "Bundler"` or `"NodeNext"`.)

Publish:

```bash
# from Deno
deno publish

# or via npx without installing Deno
npx jsr publish
```

First publish creates the scope (you'll be prompted to authenticate at jsr.io).

---

## 10. Keeping npm and JSR in lockstep

The trap: you fix a bug, publish to npm, forget JSR. A month later they diverge.

Two practical guards:

1. **Single source of truth for version**: write a small script that reads `package.json#version` and patches `jsr.json#version` (or vice versa) before each publish. Wire it into `prepublishOnly`.
2. **CI on tag push**: on `git push --tags`, run both `npm publish` and `npx jsr publish` from GitHub Actions. The tag is the trigger, the workflow does both.

Minimal release workflow (`.github/workflows/release.yml`):

```yaml
name: Release
on:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write    # required for JSR OIDC auth
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - uses: denoland/setup-deno@v1
        with: { deno-version: v1.x }
      - run: npx jsr publish
```

With OIDC, JSR doesn't need a token — GitHub's identity is enough.

---

## 11. Order of operations (the actual to-do list)

1. **Decide the feature set** (§1). Write it down in the README before writing code.
2. **Bootstrap** (§2–4): `package.json`, `tsconfig.json`, `tsup.config.ts`.
3. **Implement the core** (§5–6): `request.ts` first, then `client.ts`, then `errors.ts`. Skip retries and interceptors on the first pass.
4. **Tests** (§7): write them alongside, not after.
5. **Dogfood it**: use `zapros` in one real project (`npm link` or a workspace). Find the friction. Fix the friction. *Then* add retries/interceptors if still needed.
6. **Publish to npm** (§8) as `0.1.0` once you'd actually recommend it to a colleague.
7. **Add JSR** (§9): add `jsr.json`, fix any slow-type warnings, `npx jsr publish`.
8. **Wire CI** (§10).
9. **Iterate**: every feature must justify its weight against the "easier than axios" goal.

---

## 12. Things to *not* do (cheap mistakes)

- Don't reach for `node-fetch`, `undici`, or `cross-fetch`. The platform `fetch` is enough on Node ≥18.
- Don't expose the raw `Response` everywhere by default — you'll re-create fetch's ergonomic problems.
- Don't add a plugin system before you have three plugins you actually wrote.
- Don't ship CJS-only or ESM-only on npm. Ship both, or you'll get complaints from one camp.
- Don't forget `engines.node` in `package.json` — it documents the floor and blocks installs on ancient Node.
- Don't publish `0.x` and treat it like stable. Use `0.x` to break things freely until the API feels right; then cut `1.0.0`.
