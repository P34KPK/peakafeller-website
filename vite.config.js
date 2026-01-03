import { defineConfig } from 'vite'

export default defineConfig({
    // Si vous déployez sur https://<USERNAME>.github.io/<REPO>/
    // changez la base ci-dessous par '/<REPO>/'
    base: './',
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                beta: 'beta.html',
                sampler: 'sampler.html',
                recycleur: 'recycleur.html',
            },
        },
    },
})
