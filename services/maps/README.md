# Maps worker

The production image renders the live OpenStreetMap basemap by default, with a
fixed center/radius from the job input. Overlay updates composite markers onto a
cached basemap PNG (`basemap_<revision>.png` per run) so framing stays stable.

For deterministic local or CI runs only, enable the bundled basemap fixture:

```bash
LOCALMANAGER_MAPS_FIXTURE=1 python render.py --self-test
LOCALMANAGER_MAPS_FIXTURE=1 python -m unittest discover -v
```
