import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { access, mkdir, writeFile, rm } from 'node:fs/promises';
import { Coordination } from '../packages/persistence/src/redis.js';
import { createGameServer } from '../apps/game-server/src/server.js';
import { createPlaytestGateway } from '../apps/game-server/src/playtest.js';

let redis:Coordination|undefined,tunnel:ChildProcess|undefined,game:ReturnType<typeof createGameServer>|undefined;
let gateway:ReturnType<typeof createPlaytestGateway>|undefined,stopping=false,stage='checking the client build';
async function stop(){if(stopping)return;stopping=true;tunnel?.kill();await gateway?.close();await game?.close();await redis?.close();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void stop();});
try {
  await mkdir('artifacts',{recursive:true});await rm('artifacts/playtest-error.txt',{force:true});
  await access('dist/client/index.html');
  stage='connecting to local Redis (check that Redis is running and REDIS_URL is correct)';
  redis=new Coordination(process.env.REDIS_URL??'redis://127.0.0.1:6379');
  await redis.connect();await redis.client.ping();
  stage='starting the local game gateway';
  game=createGameServer({port:0});
  const code=randomBytes(12).toString('hex'),backendPort=await game.listen();
  // Reserve the actual free port before starting the tunnel. No invite is exposed yet.
  gateway=createPlaytestGateway({origin:'https://pending.invalid',code,backendPort,redis,port:0});
  const gatewayPort=await gateway.listen();
  stage='starting Cloudflare Tunnel (check internet access and CLOUDFLARED_PATH)';
  tunnel=spawn(process.env.CLOUDFLARED_PATH??'cloudflared',['tunnel','--url',`http://127.0.0.1:${gatewayPort}`,'--no-autoupdate'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  const child=tunnel;
  const origin=await new Promise<string>((yes,no)=>{
    let output='';
    const timer=setTimeout(()=>no(Error(`Tunnel startup timed out. ${output.slice(-1500)}`)),45000);
    const read=(chunk:Buffer)=>{output=(output+chunk.toString()).slice(-8000);const match=output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match){clearTimeout(timer);yes(match[0]);}};
    child.stdout!.on('data',read);child.stderr!.on('data',read);
    child.once('error',error=>{clearTimeout(timer);no(error);});child.once('exit',(code)=>{clearTimeout(timer);no(Error(`Tunnel exited (${code}). ${output.slice(-1500)}`));});
  });
  if(stopping)throw Error('Startup cancelled');
  gateway.setOrigin(origin);
  console.log(`\nPlaytest link: ${origin}\nInvite code: ${code}\nLocal gateway port: ${gatewayPort}\nShare the link and code with your testers. Keep this terminal open; Ctrl+C stops hosting.\nProgress remains in memory and resets when hosting stops.\n`);
  tunnel.once('exit',()=>{if(!stopping){console.error('Tunnel stopped. Run the launcher again for a new link.');process.exitCode=1;void stop();}});
}catch(error){
  const detail=error instanceof Error?error.message:'Unknown startup failure';
  const message=`Playtest failed while ${stage}: ${detail}`;
  console.error(message);await writeFile('artifacts/playtest-error.txt',message).catch(()=>{});
  await stop();process.exitCode=1;
}
