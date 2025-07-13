import { defineConfig } from "vite";
import importMap from "@titovdima/vite-plugin-import-map";

export default defineConfig(() => {
    return {
        plugins: [importMap({
            imports: {
                "@dimforge/rapier3d-simd": "./rapier3d-f64/rapier3d-bundle.js"
            }
        })],
        base: "./",
        build: {
            outDir: "build",
            target: "esnext"
        },
        server: {
            port: 3000,
            open: true,
        }
    };
});