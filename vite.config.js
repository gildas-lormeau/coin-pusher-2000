import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";


export default defineConfig(() => {
    return {
        plugins: [wasm()],
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