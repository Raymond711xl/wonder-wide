# Wonder Wide agent workflow

## User-facing defaults

- Keep setup invisible to the user. Do not ask them to run terminal commands when the Agent can complete the work.
- When the user supplies the live Wonder Wide URL, open that site and help them use it. Do not create another deployment unless they request their own copy.
- When the user supplies the GitHub repository URL and asks for a deployment, create and deploy an independent copy with Codex Sites, then return its URL.
- Default a newly created copy to private access unless the user explicitly requests broader sharing.

## Sites project isolation

- Treat `.openai/hosting.json` as local, per-checkout state. It is intentionally ignored by Git.
- Never reuse the repository author's `project_id` for another user's deployment.
- If the file is absent or has no `project_id`, create one new Sites project exactly once and save the returned ID locally.
- Reuse an existing local `project_id` for later updates to the same copy.

## Deployment path

1. Preserve the existing package manager, lockfile, Vinext structure, and product content.
2. Install dependencies only when needed.
3. Validate with `npm run lint` and `npm test`.
4. Publish the exact validated source with Codex Sites.
5. Return the deployed URL. Keep build, packaging, credentials, project IDs, and hosting internals out of the user-facing handoff.

## Product boundaries

- Travel records live in the browser's `localStorage`; there is no account system or cloud sync.
- Records do not move automatically between browsers, devices, Agents, or independently deployed copies.
- City search and landmark recommendations require network access to Nominatim and Overpass.
