# Stationen Kraft & Hebel

Interaktive 3D-Lernplattform für Physik (Klasse 8) mit fünf Stationen: Hookesches Gesetz (Federkraft und Federverlängerung), einseitiger Hebel, zweiseitiger Hebel und Alltags-Check.

- **`index.html`**: die fertige Datei. Sie läuft komplett offline (three.js ist eingebettet) und lässt sich direkt in Safari auf dem iPad öffnen.
- **`quellen/`**: der Quellcode (`src/template.html`, `core.js`, `stations.js`, `alltag.js`) und `build.py`, das alles zu einer Datei zusammenbaut.

## Neu bauen

```bash
cd quellen
npm pack three@0.149.0 && mkdir -p lib && tar -xzf three-0.149.0.tgz -C lib
python3 build.py ../index.html
```
