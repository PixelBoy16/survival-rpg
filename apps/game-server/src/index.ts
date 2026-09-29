import { createGameServer } from './server.js';
const server = createGameServer();
try { const port = await server.listen(); console.log(JSON.stringify({ event: 'server_ready', host: '127.0.0.1', port })); } catch (error) { console.error(error); await server.close(); process.exitCode = 1; }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void server.close().then(() => process.exit()); });
