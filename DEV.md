# Development Workflow

## Source of truth

The working copy lives at:

```
.obsidian/plugins/anki-sender/main.js
```

Edit there, test there (reload Obsidian), then copy here before pushing.

## Release checklist

1. Edit `.obsidian/plugins/anki-sender/main.js`
2. Test in Obsidian (reload app)
3. Copy `main.js` to this directory
4. Update `manifest.json` version if needed
5. `git add . && git commit && git push`
6. Create GitHub Release with new tag
7. Upload `main.js` + `manifest.json` to Release assets
