import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const webOffline=process.env.BOOTHBOOK_WEB_OFFLINE==='1';
export default defineConfig({root:root+'standalone',base:webOffline?'/offline/':'/',publicDir:webOffline?false:root+'public',plugins:[react()],resolve:{alias:{'@':root}},css:{postcss:root},build:{outDir:root+(webOffline?'public/offline':'dist-local/client'),emptyOutDir:true}});
