# Bridge Protocol Rework (2026-02-15)

## Goal
Refactor bridge communication to a hybrid model:
- Request/Response for command and result
- Event Push (SSE) for status/log updates
- File-based payload for PS capture data

## Current Source of Truth
- Desktop main process: `electron/main.js`
- Bridge server: `server/index.js`
- PS plugin executor: `ps-plugin-uxp-starter/index.js`

## New/Updated Endpoints

### Command channel (request/response)
- `POST /queue`
  - enqueue command (`capture-selection`, `capture-canvas`, `import-image`, `reconnect`)
- `GET /queue/next?waitMs=...`
  - long-poll command fetch for plugin
  - returns `{ id: null }` on timeout

### Result channel (request/response)
- `POST /queue/result`
  - plugin submits command result
- `GET /queue/result/:id`
  - immediate check (legacy compatible)
- `GET /queue/result/:id/wait?timeoutMs=...`
  - long-poll wait for result (desktop main uses this)

### Event channel (push)
- `GET /events`
  - SSE stream, events include:
    - `queue.enqueued`
    - `queue.dispatched`
    - `queue.result`
    - `ps.connection`
    - `ps.log`

### Plugin sync
- `POST /ps/heartbeat`
- `POST /ps/log`
- `GET /ps/logs` (legacy pull compatible)
- `POST /ps/selection`
- `POST /ps/canvas`
- `POST /ps/import`

## Data plane (capture)
Plugin sends file reference, not inline base64:
- `image.filePath`
- `image.mimeType`
- `image.width`, `image.height`
- `image.selection`
- `image.documentId`, `image.documentName`

Server persists:
- image binary -> `server/data/ps-capture-cache/*.png|jpg`
- metadata comm file -> `server/data/ps-capture-comm/*.json`

Desktop main reads comm file and converts to data URL for webui.

## Runtime flow
1. WebUI asks desktop main for capture.
2. Main enqueues command to bridge.
3. Plugin long-polls `/queue/next` and executes command.
4. Plugin uploads capture info (file path) and reports `/queue/result`.
5. Main waits via `/queue/result/:id/wait`, then reads comm file.
6. WebUI receives ready image payload.

## Compatibility policy
- Keep old endpoints working during migration.
- Allow both `/queue/result/:id` and `/queue/result/:id/wait`.
- Keep `/ps/logs` pull path until console rewrite is complete.

## Validation checklist
- [ ] capture-selection returns image payload
- [ ] capture-canvas returns image payload
- [ ] import-image returns success/failure with queue id
- [ ] plugin reconnect works after port change
- [ ] long-poll does not create duplicate queue consumer loops
- [ ] SSE `/events` stream can be subscribed without UI freeze
