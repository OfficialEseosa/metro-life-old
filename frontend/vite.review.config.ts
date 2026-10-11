import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
// Isolated, local-only review server. Production has no fixture endpoints.
export default defineConfig({plugins:[react()],server:{port:5174,proxy:{'/api':'http://localhost:8081','/ws':{target:'ws://localhost:8081',ws:true}}}})
