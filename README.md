# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv create --template minimal --types ts --add playwright drizzle="database:mysql+mysql:mysql2+docker:no" better-auth="demo:password,github" paraglide="languageTags:en, de+demo:no" mcp="ide:gemini,other+setup:remote" vitest="usages:unit,component" --install pnpm ./
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Trail editor soak test

Start with a small pass count:

```powershell
$env:PLAYWRIGHT_SOAK_PASSES = "3"
pnpm exec playwright test --project=soak tests/wanderwegeErstellen/wanderweg-erstellen.soak.spec.ts
```

Playwright starts an isolated Vite server on port 5174 with a test-only mock
user that has the `trailMaking` claim. This identity is enabled only in
development, for loopback requests, and when Playwright explicitly sets
`PLAYWRIGHT_TEST_AUTH=1`; normal development and production authentication
remain unchanged. The test mocks trail and POI data, pathfinding responses, map
tiles, and geocoding. Increase `PLAYWRIGHT_SOAK_PASSES` for longer runs. Vite
is started directly with Node to avoid the pnpm shell shim on Windows.
