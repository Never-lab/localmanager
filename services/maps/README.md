# Maps worker

The production image renders the live OpenStreetMap basemap by default.

For deterministic local or CI runs only, enable the bundled basemap fixture:

```bash
LOCALMANAGER_MAPS_FIXTURE=1 python render.py --self-test
```
