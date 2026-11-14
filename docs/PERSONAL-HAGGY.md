# Connect your own AI to Haggy

Haggy can talk to your locally installed Claude Code or Codex CLI from the
Haggs web panel. A local companion gives that AI a project-scoped MCP server.
Replies and tool changes appear in the panel. This starts a fresh conversation;
it does not import your desktop application's chat history.

## Start

1. Install the Haggs repository dependencies with `npm ci` (Node 22+).
2. Install a recent Claude Code or Codex CLI. Codex must be 0.138 or newer.
3. Sign in locally using `claude auth login` or `codex login`, choosing your
   desktop subscription account. API-key authentication is not used by this connector.
4. In the Haggs checkout, run `npm run haggy:connect`. Keep that terminal open.
5. Open **Ask Haggy → Connect my AI**, enter the displayed one-use pairing code,
   then choose your AI and project. No provider key belongs in the pairing form.
6. Ask for an edit, for example: “Read this board and shorten the opening shot to
   two seconds.” The panel shows each applied change with Undo.

Your AI account's usage and limits apply. This does not make a paid AI account
free, or authorize media generation. Claude API-key chat remains a separate mode.

The default companion address is `http://127.0.0.1:3211`. For another port use
`npm run haggy:connect -- --port 3212` and enter that address in the panel.
For your own deployment add its exact origin:
`npm run haggy:connect -- --origin https://studio.example.com`.
Do not expose or proxy the companion to the public internet.

## Browser connection and recovery

Allow local-network access when the browser requests it. The terminal must run on
**the same computer as your browser**, even when Haggs itself is hosted. Some
browser/enterprise policies block hosted-page access to loopback; use a supported
browser or run Haggs locally in that case. Local-network permission is not an AI
login. A phone cannot reach a companion running on your laptop via its loopback URL.

Pairing codes expire after ten minutes and rotate after successful pairing.
Browser sessions expire after eight hours and are bound to the exact web origin.
Keep codes private. Disconnect revokes the browser session and stops its turn.

If a page refresh or connection loss interrupts a turn, choose **Recover existing
turn**. Haggs reconnects to that turn ID instead of starting a second model request.
Tool receipts prevent repeating an acknowledged edit. An uncertain interrupted edit
stops the turn and asks you to inspect the board. Stop terminates the local runner.
There is no automatic model retry. Restarting the companion loses its in-memory
turn journal; review the board before beginning another conversation.

Conversation and receipt state live in this tab's session storage. They clear on
account changes and are not synchronized to another device. Undo cards are for the
current mounted conversation; reload restores conversation text and pending work,
not previously displayed Undo cards. Existing studio version/history tools remain
available. Switching AI or project starts a fresh chat.

## Boundaries

- Provider credentials remain in the installed CLI. API-key environment variables
  are omitted from child processes; raw login output and runner stderr are not logged.
- Each turn gets an isolated temporary directory and a job-specific MCP token.
- The MCP server exposes Haggs' existing planning/editing tools, scoped to the
  selected project. No generation, shell, delete or credential tool is provided.
- Claude uses restricted tool selection and explicit MCP configuration. Codex uses
  an explicit read-only filesystem profile, disabled shell/plugins/hooks and
  network tools, and an isolated configuration. Treat the local AI CLIs as trusted
  installed applications, not a security boundary against malicious native code.
- Model processing still takes place with your selected AI provider; selected
  project content and conversation are sent there. Pair only with an app origin
  and computer you trust. Disconnect after use on a shared computer.

## Verification for this change

Automated tests cover both provider event formats, real SDK MCP transport,
project edits and Undo, origin/session isolation, event replay, Stop, Disconnect
and incomplete-response failure. Browser tests cover both simulated providers,
refresh/recovery and mobile layout. These use deterministic test AI responses,
not a live Claude/Codex model. A separate installed-Codex probe against a local
mock model validated CLI configuration and fail-closed file access. No real
personal-model request or paid generation was submitted. Hosted browser access
and real subscription turns still require end-to-end verification before a
production readiness claim.
