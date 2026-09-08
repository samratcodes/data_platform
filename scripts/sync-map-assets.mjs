import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// MapLibre 6 module workers need an explicit URL when bundled by Turbopack.
const destination = join(process.cwd(), "public", "vendor", "maplibre");
mkdirSync(destination, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(process.cwd(), "node_modules", "maplibre-gl", "dist", file), join(destination, file));
}
copyFileSync(join(process.cwd(), "node_modules", "maplibre-gl", "LICENSE.txt"), join(destination, "LICENSE.txt"));
