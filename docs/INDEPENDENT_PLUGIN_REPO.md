# Keeping Your Plugin Repository Independent Of Tracker

Instructions for maintaining your own plugin collection — called `ohio` here — inside a `tracker` checkout, without registering it as a submodule.

The key idea is that plugins under the `custom` folder are ignored by tracker, so you work there.

## Setup

This adds your own plugins inside the tracker copy you checked out, and to tell Git that they don't belong in tracker.

```bash
git clone <tracker-url> tracker
cd tracker
git clone <ohio-url> src/plugins/custom/ohio
npm install
```

Run these from the `tracker` root. `src/plugins/custom/` is already in Tracker's `.gitignore`, so the plugin checkout remains separate from Tracker.

All your plugins must live under `src/plugins/custom/ohio`. Subfolders can be used to keep things organized — but note that the plugin is identified by its **leaf folder name**, not by its path.

A plugin at `src/plugins/custom/ohio/video/lowerthird/config.js` is reached at:

```
/lowerthird
```

Leaf folder names are therefore a single flat namespace shared with every other plugin in the tree. Do not reuse a name already used under `src/plugins`, or one of the two will silently overwrite the other.

## Create Your VS Code Workspace

The trick is to create the workspace in the `ohio` subfolder, so you can have your own settings.

1. **File → Open Folder…** and select `tracker/src/plugins/custom/ohio`.
2. **File → Add Folder to Workspace…** and select the `tracker` folder.
3. **File → Save Workspace As…** and save it as `tracker/src/plugins/custom/ohio/ohio.code-workspace`.

From then on, open the Ohio workspace file — not either folder on its own: **File → Open Workspace from File…** → `ohio.code-workspace`, or pick it from **File → Open Recent**.

The saved file looks like this. Paths are relative to the file's own location, so `../../../..` is the tracker root:

```json
{
  "folders": [
    { "path": ".", "name": "ohio" },
    { "path": "../../../..", "name": "tracker" }
  ]
}
```

The workspace file lives in your own repository, so commit it to `ohio` and it travels with your clone. Tracker ignores the containing `custom` folder.

Put any VS Code settings you want in the `"settings"` block of this file, or in `src/plugins/custom/ohio/.vscode/settings.json`. Do not edit `tracker/.vscode/settings.json` or `tracker/owlcms-tracker.code-workspace` — those are tracked upstream and will conflict on pull.

The Source Control view lists two repositories. Use the picker at the top of the view to choose which one you are committing to.

## Daily Use

Update tracker:

```bash
cd tracker
git pull
npm install
```

Dependencies — including `@owlcms/tracker-core`, which is pinned to a GitHub tag — are fetched by npm; there is nothing to clone for them.

Commit your work as usual using VSCode or Git

```bash
cd tracker/src/plugins/custom/ohio
git add -A
git commit -m "..."
git push
```

## If You Previously Used Submodules

If `ohio` is currently registered as a submodule of your `tracker` fork, undo that setup before following the instructions above.

IMPORTANT: Save and push any uncommitted work first, then remove the submodule registration from `tracker`:
BEWARE: this deletes your files locally; performing the setup will bring them back.

```bash
cd tracker
git submodule deinit -f src/plugins/custom/ohio
git rm -f src/plugins/custom/ohio
rm -rf .git/modules/src/plugins/custom/ohio
git commit -m "Unregister ohio submodule"
```

`git rm` drops both the pinned commit and the `.gitmodules` entry. Deleting `.git/modules/...` clears the cached submodule repository, which otherwise blocks a later clone into the same path.

Then follow [Setup](#setup) above.

