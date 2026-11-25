# GC Returns Pro — website + bridge

- `extension/`  Chrome/Edge extension (the "bridge" that holds GST portal permissions)
- `docs/`       Website served by GitHub Pages (Settings → Pages → branch `main`, folder `/docs`)
- `installer/`  Inno Setup script → builds `GCReturnsPro-Setup.exe`
- `.github/workflows/build-installer.yml`  compiles the .exe on GitHub and attaches it to a Release

Before first release replace `A3th0r` in:
`extension/manifest.json`, `extension/site-bridge.js`, `installer/GCReturnsPro.iss`, `docs/index.html`.
