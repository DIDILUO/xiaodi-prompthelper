# Code Search Index (Global Audit)

Updated: 2026-03-03  
Scope: `prompthelper-bridge-recovered/webui`

## 1) Fast conclusion

- Frontend is a monolith right now:
  - `src/App.jsx` (~45,207 lines, ~1.6 MB)
  - `src/App.css` (~7,276 lines)
- Most behavior is in `App.jsx` (chat, run queue, drag, overlays, import/export).
- Best workflow for edits:
  1. locate state/ref
  2. locate render entry
  3. patch behavior
  4. patch CSS

## 2) Directory quick map

## Workspace root

- `prompthelper-bridge-recovered/`
- `docs/`
- `plans/`
- `logs/backups` dirs in workspace root

## Main app project

- `prompthelper-bridge-recovered/docs/`
- `prompthelper-bridge-recovered/electron/`
- `prompthelper-bridge-recovered/server/`
- `prompthelper-bridge-recovered/webui/`
- `prompthelper-bridge-recovered/scripts/`

## Frontend (primary)

- `prompthelper-bridge-recovered/webui/src/App.jsx`
- `prompthelper-bridge-recovered/webui/src/App.css`
- `prompthelper-bridge-recovered/webui/src/main.jsx`
- `prompthelper-bridge-recovered/webui/src/assets/icons/`
- `prompthelper-bridge-recovered/webui/src/assets/presets/`
- `prompthelper-bridge-recovered/webui/src/assets/images/`
- `prompthelper-bridge-recovered/webui/src/assets/fonts/`

## 3) Size hotspots

- `src/App.jsx`: 45207 lines
- `src/App.css`: 7276 lines
- `src/main.jsx`: 16 lines

## 4) Chain anchors (jump points)

## 4.1 Chat chain (session-scoped concurrent send/cancel)

- session lock ref: `App.jsx:19210` `chatRequestInFlightLockRef`
- active session pending flag: `App.jsx:20122` `isChatResponsePendingOrLocked`
- send entry (composer): `App.jsx:39911` `sendChatFromComposer`
- send execution by session: `App.jsx:38438` `sendChatRequestForSession`
- keydown enter path: `App.jsx:40018` `handleComposerKeyDown`
- cancel current session: `App.jsx:40033` `stopChatGeneration`
- send/cancel button render: `App.jsx:42774` `renderComposerChatInputRow`

## 4.2 Run queue chain (global queue + header task panel)

- queue state: `App.jsx:20046` `imageRunQueueState`
- display count: `App.jsx:24729` `runQueueDisplayCount`
- single task cancel: `App.jsx:27962` `cancelRunQueueTaskById`
- queue worker loop: `App.jsx:28106` `processRunQueueLoop`
- stop all queue tasks: `App.jsx:28198` `stopRunQueueAndAbort`
- enqueue: `App.jsx:28267` `enqueueRunTask`
- task panel button render: `App.jsx:43334` `renderRunQueueTaskButton`
- chat header entry: `App.jsx:43639` `renderChatHeaderActions`
- instruction header entry: `App.jsx:43452` `renderInstructionHeaderActions`

## 4.3 Session import/export

- export sessions: `App.jsx:36577` `exportActiveChatHistory`
- import handler: `App.jsx:45119` `handleChatSessionImportInputChange`
- import input ref: `App.jsx:19217` `chatSessionImportInputRef`
- overlay mount: `App.jsx:17509` `AppOverlayNodes`

## 4.4 Instruction tag drag chain (performance-sensitive)

- drag state ref: `App.jsx:19559` `instructionTagPointerDragRef`
- drop zone cache: `App.jsx:19578` `instructionTagDropZoneCacheRef`
- drop target key helper: `App.jsx:6882` `buildInstructionTagDropTargetKey`
- pointer down entry: `App.jsx:33640` `handleInstructionTagPointerDown`
- pointer move: `App.jsx:33771` `handleInstructionTagPointerMove`
- pointer commit/up: `App.jsx:33847` `handleInstructionTagPointerCommit`
- list render entry: `App.jsx:34347` `instruction-panel-groups`

## 5) CSS anchors

## 5.1 Run queue task UI

- button base: `App.css:2007` `.run-queue-stop-btn`
- active color: `App.css:2027` `.run-queue-stop-btn.is-active`
- task panel: `App.css:2054` `.run-queue-task-panel`
- task item row: `App.css:2102` `.run-queue-task-item`

## 5.2 Chat send/cancel button

- session cancel state style: `App.css:3600` `.send-btn.is-stop`

## 5.3 Instruction drag visuals

- group drag state: `App.css:4595` `.instruction-panel-groups.is-pointer-drag-active`
- tag list: `App.css:4738` `.instruction-tag-list`
- gap vars: `App.css:4757` `--instruction-drag-gap-size`
- placeholder: `App.css:4793` `.instruction-tag-menu-anchor.is-pointer-drag-placeholder`

## 6) Common search commands

```powershell
# Chat send/cancel/concurrency
rg -n "sendChatRequestForSession|sendChatFromComposer|stopChatGeneration|chatRequestInFlightLockRef" src/App.jsx

# Run queue
rg -n "enqueueRunTask|processRunQueueLoop|cancelRunQueueTaskById|stopRunQueueAndAbort|renderRunQueueTaskButton" src/App.jsx

# Instruction drag
rg -n "instructionTagPointerDragRef|instructionTagDropZoneCacheRef|handleInstructionTagPointerDown|handleInstructionTagPointerMove|handleInstructionTagPointerCommit" src/App.jsx

# Import / export
rg -n "exportActiveChatHistory|handleChatSessionImportInputChange|exportImageQuickPrompts|importImageQuickPrompts" src/App.jsx

# CSS hotspots
rg -n "run-queue-task-panel|run-queue-stop-btn|send-btn.is-stop|instruction-tag-list|is-pointer-drag-placeholder" src/App.css
```

## 7) Pre-edit checklist

- Decide if state is session-scoped or global-scoped before editing.
- Touch logic in this order: state/ref -> behavior -> render -> CSS.
- For pointer/drag edits, verify:
  - no high-frequency redundant `setState`
  - no unnecessary repeated `getBoundingClientRect` in hot path
  - overlay close-outside logic still works
- Run build after changes:
  - `npm run build`

## 8) Version header reminders

Current file header versions:

- `App.jsx`: `recovered-ce8k-r59`
- `App.css`: `recovered-ce8k-r61`

If you keep iterating, update `@phb-version-*` headers with each meaningful batch.

