# GC Returns Pro — website + bridge

- `extension/`  Chrome/Edge extension (the "bridge" that holds GST portal permissions)
- `docs/`       Website served by GitHub Pages (Settings → Pages → branch `main`, folder `/docs`)
- `installer/`  Inno Setup script → builds `GCReturnsPro-Setup.exe`
- `.github/workflows/build-installer.yml`  compiles the .exe on GitHub and attaches it to a Release

Before first release replace `A3th0r` in:
`extension/manifest.json`, `extension/site-bridge.js`, `installer/GCReturnsPro.iss`, `docs/index.html`.

## Module updates from GitHub (tag-based, prompted)

Every time the popup opens, `extension/remote-registry.js` asks GitHub for the newest
version tag of `A3th0r/NEOGST` (cached 10 min). If it is newer than what is installed,
a banner offers **Update** / **Skip**. Update downloads the registry data pinned to that tag
(`extension/registry.json`, or `extension/registry.bundle.js` as fallback), validates it and
reloads the popup. Only JSON data is downloaded - never evaluated - so it is MV3 / Chrome Web
Store / Edge Add-ons compliant.

To ship a module change:
1. Edit `src/modules/...`, run the registry build so `extension/registry.bundle.js` is regenerated.
2. Commit, then tag: `git tag v2.9.1 && git push --tags`.
3. Users see the banner next time they open the extension. Tags must look like `v2.9.1`.

If the change needs new engine code (popup.js, computed-engine.js, ...), bump the extension
version and publish the extension itself; optionally add `"minExtensionVersion": "x.y.z"` to the
registry so older extensions refuse the data instead of breaking.
