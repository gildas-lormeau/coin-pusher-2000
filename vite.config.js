import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    base: "./",
    resolve: {
        alias: {
            "@dimforge/rapier3d-simd": path.resolve(projectRoot, "./rapier3d-f64/rapier3d-bundle.js")
        }
    },
    build: {
        outDir: "build",
        target: "esnext"
    },
    server: {
        port: 3000,
        open: true,
    }
});
