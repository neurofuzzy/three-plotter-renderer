import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Serve examples during development
    root: '.',
    publicDir: false,

    build: {
        lib: {
            entry: resolve(__dirname, 'src/plotter-renderer.js'),
            name: 'ThreePlotterRenderer',
            fileName: (format) => `three-plotter-renderer.${format}.js`,
            formats: ['es', 'umd'],
        },
        rollupOptions: {
            external: ['three'],
            output: {
                globals: {
                    three: 'THREE',
                },
            },
        },
        outDir: 'dist',
    },

    server: {
        open: '/examples/',
    },

    optimizeDeps: {
        include: ['three'],
    },
});
