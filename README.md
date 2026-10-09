# 📓 Cozy Notebook

A cozy **desktop** notebook app (Windows · macOS · Linux, built on Electron). Notebooks live on a bookshelf, open like real ring-binders, and everything is saved automatically as files on your computer – no account, no cloud.

## Run it

```bash
npm install
npm start
```

Build an installer for your OS: `npm run dist` (or `dist:win` / `dist:mac` / `dist:linux`).

## What's inside

| | |
|---|---|
| **Notebooks** | Bookshelf with custom covers (colour, texture, emoji) and binding: 3-ring binder, 6-ring planner, spiral, stitched, plain |
| **Sections & pages** | Coloured divider tabs, drag-to-reorder pages, move pages between sections, 9 page templates (journal, weekly planner, meeting notes, recipe, …) |
| **Sticky notes** | On every page *and* on each section's pin-board (cork board) – curled, pinned or taped styles, 10 colours |
| **Movable text boxes** | OneNote-style: click anywhere, type, drag, resize, rotate. Rich text: fonts, sizes, colours, highlight, lists, alignment |
| **Images** | Insert / drag-drop / paste. Crop (with ratios), rotate, flip, filters (brightness, contrast, saturation, hue, blur, B&W, sepia…), presets, rounded corners, borders, shadow, polaroid & taped frames |
| **Pen-tablet ink** | Pressure-sensitive pen, pencil, highlighter, stroke eraser (flip your stylus to erase), lasso to select/move/recolour ink, hold-to-straighten, palm rejection ("stylus only") |
| **Decorations** | Paper clips, binder clips, push-pins, bookmarks, washi tape, label stickers, 200+ emoji stickers, shapes & arrows, checklists |
| **Papers** | Blank, lined, grid, dotted, Cornell, legal, music staff – any page colour |
| **Everything else** | Undo/redo, copy/paste, duplicate, z-order, align/distribute, snap-to-grid, zoom, full-text search (Ctrl+K), PDF export/print, backup & import, 6 themes |

Press **?** inside a notebook for the shortcut list.

## Where is my data?

`library.json` + an `assets/` folder inside the app's user-data directory (Settings → *Open data folder*). Use *Export* for portable backups.

## Layout

```
main.js / preload.js   Electron shell + native file storage
index.html, css/       UI
js/store.js            data model + persistence
js/ink.js              vector ink engine
js/items.js            page objects (text, sticky, image, shape, sticker, clip, checklist)
js/editor.js           selection, move/resize/rotate, text editing, history
js/inspector.js        property panel + image crop
js/ui.js, app.js       toolbars, dialogs, shelf, sections, pages
```
