# Smallest demo starter

SvelteKit 3 + Svelte 5 (runes) + Tailwind v4 + shadcn-svelte (Bits UI) with the Smallest demo tokens applied. Light, warm paper, one blue accent.
Read `../DEMO_DESIGN_GUIDE.md` first.

```sh
npm install
npm run dev -- --host 127.0.0.1   # http://127.0.0.1:5173
npm run build                     # static site in build/
npm run check                     # svelte-check
```

- Tokens: `src/routes/layout.css` (only place colors/fonts/radii are defined).
- Voice state panel: `src/lib/components/voice/MicState.svelte` (+ `Wave`, `Elapsed`, `types.ts`).
- Page template: `src/routes/+page.svelte` (two-column workbench; delete the "Preview a state" tabs before filming).
- Add components: `npx shadcn-svelte@latest add -y <name>`.
- Gotchas: SvelteKit 3 uses the `#lib` alias (not `$lib`); do not name a variable `state` (collides with `$state`).
