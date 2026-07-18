# AGENTS.md for Maribbit's Blog 2.5D

## Talking Philosophy: Be economical

- Read only the files you need; don't re-read the whole repo when a targeted read suffices.
- Reply in **English**, concise. Code / file names / commit messages stay in English.

## Design Philosophy: Be perfect

- I want my blog to be beautiful in every detail. I want to explore the limits of Astro and 2.5D graphics programming.
- I don't like traditional 2D blogs. I want to create a blog that is visually stunning and interactive, with 2.5D graphics that make the content come alive.

## Agent Workflow: Browser Access

- **Prefer existing tools first.** Before writing any Playwright code, check the
  current context for a browser or screenshot tool (e.g. MCP browser tools,
  built-in screenshot capabilities). Use that if available.
- **Confirm browser availability.** Operating systems and local browser installs
  vary. Do not assume macOS or a specific Chrome path. Verify what browser
  binary or channel is available before launching anything.
- **Avoid redundant downloads.** `@playwright/test` is already a dev dependency.
  Do not re-install it. Avoid downloading Playwright browsers unless necessary;
  prefer a system-installed Chrome, Chromium, or Edge. If a download is required
  (e.g. for video), do it once and avoid repeating it.
- **Visual verification.** When checking layout, proportions, or SVG rendering,
  capture a screenshot and read the image. For fine SVG animation (breathing,
  blinking, clock movement), use a combination of multi-frame screenshots and
  computed style / transform inspection.
- **Clean up artifacts.** Save screenshots or videos under `screenshots/` or a
  temporary directory, and remove them when the task is done. Do not commit them.

## Latest Documents

- `README.md`: project overview, tech stack, and instructions for running the blog locally.
- `AGENTS.md`: this file — project conventions for agents.
- `Astro Docs`: use the MCP server to read the latest Astro docs. Use `astro-docs/*` tool for this.