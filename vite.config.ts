import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/casebook/',plugins:[react()],build:{outDir:'docs'},server:{host:'127.0.0.1',port:4174,strictPort:true},test:{environment:'node'}} as Parameters<typeof defineConfig>[0]);
