import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";


export default defineConfig(() => {
    return {
        plugins: [wasm(), {
            name: 'html-transform',
            transformIndexHtml(html) {
                return html.replace(/<head>/, `<head>\n  <base href="/build/">`);
            }
        }],
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