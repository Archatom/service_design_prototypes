import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/service_design_prototypes/',
    plugins: [react()],
    server: {
        port: 5173,
        host: true,
    },
});
