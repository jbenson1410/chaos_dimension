# Chaos Dimension

> A note from the author: I wanted a JIRA, but for me. Specifically, a JIRA with a control panel for dispatching coding agents and watching them work. I looked and did not find one. So I built it, and I made it look like a 1991 Macintosh, because if I'm going to stare at a project tracker all day it should at least be fun.

A retro Mac OS System 7-styled mission control for personal projects and AI agent orchestration. Kanban on the left, agent terminal monitor on the right, blue dither desktop everywhere.

| Classic Mac OS | Minimal |
| --- | --- |
| ![Classic Mac OS theme](screenshots/theme-classic.png) | ![Minimal theme](screenshots/theme-minimal.png) |
| **Terminal** | **Modern** |
| ![Terminal theme](screenshots/theme-terminal.png) | ![Modern theme](screenshots/theme-modern.png) |

Live demo: [chaosdimension.fyi](https://chaosdimension.fyi)

## Why

Modern project trackers are bloated, modern UIs are beige, and none of them have a column for "this task is currently being worked on by a Claude agent in a tmux pane somewhere." Chaos Dimension fixes all three problems.

## Design Choices

System 7 chrome (striped title bars, beveled buttons, inset borders) because constraint breeds taste, and because rounded corners have had their fun. Inline styles, no component library, no Tailwind — the whole point is that it looks deliberately old.

## The Name

"Chaos dimension" is a lyric from ["Almost Had to Start a Fight / In and Out of Patience"](https://open.spotify.com/track/7xhZCVsVhDSjhFm41mOX10?si=5bc063da68f24a56) by Parquet Courts, a Brooklyn band. Felt about right for a tool that orchestrates several agents trying to do several things at once.

> "Can someone tell me the reason? I'm in the Chaos Dimension. Trapped in a brutal invention." -Parquet Courts
## How to build and deploy your own Chaos Dimension

### Local development

```bash
git clone https://github.com/<you>/chaos_dimension
cd chaos_dimension
npm install
cp .env.example .env.local

# Generate the password hash for your own login
npm run hash-password
# Paste the printed bcrypt hash into .env.local as CHAOS_PASSWORD_HASH

# Generate a session secret
openssl rand -hex 32
# Paste it into .env.local as CHAOS_SESSION_SECRET

# Get a free Neon Postgres at https://neon.tech
# Paste the connection string into .env.local as DATABASE_URL

npm run db:push   # create the tables
npm run db:seed   # seed workstream definitions
npm run dev       # http://localhost:5173
```

For a fuller local run including the serverless `/api/*` handlers, install the Vercel CLI (`npm i -g vercel`) and use `vercel dev` instead of `npm run dev`.

### Deploy to Vercel

1. Push your fork to GitHub.
2. Import the repo in Vercel.
3. From the project dashboard, add Neon Postgres via the marketplace (free tier). `DATABASE_URL` is injected automatically.
4. Set `CHAOS_PASSWORD_HASH` and `CHAOS_SESSION_SECRET` in Vercel env vars.
5. Leave `CHAOS_PUBLIC_DEMO` and `VITE_PUBLIC_DEMO` unset for a private deploy — visitors get the login screen first. Set both to `true` if you want a public demo landing instead.
6. Pull the env locally and migrate: `vercel env pull && npm run db:push && npm run db:seed`.
7. Deploy.

### Connect Claude Code via MCP

Lets Claude Code (or any MCP client) read and write your tasks, claim work, and report progress from inside any coding session.

1. **Mint an API token** from a clone of this repo:
   ```bash
   npm run mint-api-key -- --label macbook
   ```
   The script prints a `cd_...` token. Copy it. (Token is shown once.)

2. **Register the MCP server with Claude Code**:
   ```bash
   claude mcp add --scope user --transport http chaos-dimension \
     https://www.your-deploy.fyi/api/mcp \
     --header "Authorization: Bearer cd_paste-your-token-here"
   ```
   The `--scope user` flag makes the server available from any project directory. Drop it for project-scoped.

3. **Restart Claude Code**, then inside it run:
   ```
   /mcp
   ```
   You should see `chaos-dimension` connected with 7 tools (`list_workstreams`, `list_tasks`, `get_task`, `create_task`, `update_task`, `claim_task`, `report_progress`).

4. **(Optional) Enable auto-tracking.** Paste the snippet from `docs/integration/CLAUDE.md.snippet` into a project's `CLAUDE.md` or your global `~/.claude/CLAUDE.md`. Claude will ask before creating tasks for non-trivial work and report progress as it goes.

### Connect Claude Desktop or claude.ai (web)

Same MCP endpoint, different setup UI:

1. **Mint a token** as in step 1 above (or run `npm run mint-api-key -- --label desktop`).
2. In **Claude Desktop** or **claude.ai**: Settings → Connectors → Add custom connector.
3. Fill in:
   - **URL:** `https://www.your-deploy.fyi/api/mcp`
   - **Authentication:** Bearer token → paste your `cd_...` token
4. Save. The chaos-dimension tools appear in any new chat.

Full MCP setup details and troubleshooting: see [`docs/integration/README.md`](docs/integration/README.md).

> **Note:** if your deploy's apex domain redirects to `www`, use the `www.` URL in step 2. MCP clients don't follow POST redirects and you'll see `JSON Parse error: Unrecognized token '<'`.

## Features

- Kanban board: Backlog → Active → Review → Done
- Agent Monitor with green-on-black terminal logs per agent
- Workstream color-coding with striped progress bars
- ⚡ markers on agent-dispatchable tasks
- Password-gated private mode + optional public demo landing (interactive, localStorage-backed)
- MCP server: connect Claude Code; tasks update from inside your coding sessions
- Four themes (Classic Mac OS, Minimal, Terminal, Modern)
- Live dashboard updates (polls every 10s when the tab is visible)

## Stack

React 18 + Vite frontend. Vercel serverless functions for `/api/*`. Neon Postgres + Drizzle ORM for persistence. `iron-session` + bcryptjs for the single-user password gate. `@modelcontextprotocol/sdk` for the MCP server.

## Roadmap

- [x] Database (Postgres via Neon)
- [x] Sign-on screen, Mac OS login dialog style
- [x] Multi-theme system (Classic / Minimal / Terminal / Modern)
- [x] Interactive demo board with localStorage persistence
- [x] MCP server (v0.4) — Claude Code claims and updates tasks via standard MCP tools
- [ ] AIM Messenger-style chat panel that routes to the Anthropic API
- [ ] Settings → API Keys management UI (currently CLI-only)
- [ ] Cloud orchestrator: ephemeral containers that run agent tasks while your laptop is closed
- [ ] Worklog export for blog posts

## Contributing

If you also want a JIRA that looks like a 1991 Macintosh: PRs welcome. Keep the aesthetic. No rounded corners. No em-dashes in UI copy.

## License

MIT
