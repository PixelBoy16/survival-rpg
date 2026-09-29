import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
const part=(id:string)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid coordination key');return id;};
export class Coordination {
  readonly client;
  constructor(url:string,tlsServername?:string){
    if(tlsServername&&!url.startsWith('rediss://'))throw Error('TLS server name requires rediss://');
    this.client=createClient({url,socket:{connectTimeout:5000,reconnectStrategy:false,...(tlsServername?{tls:true as const,servername:tlsServername,rejectUnauthorized:true}:{})}});
    this.client.on('error',error=>console.error(JSON.stringify({event:'redis_error',name:error.name})));
  }
  async connect(){await this.client.connect();}
  async close(){if(this.client.isOpen)await this.client.quit();}
  async acquireCharacter(characterId:string){const token=randomUUID();const result=await this.client.sendCommand(['SET',`haven:v1:lease:${part(characterId)}`,token,'NX','PX','30000']);return String(result)==='OK'?token:undefined;}
  async renewCharacter(characterId:string,token:string){return Number(await this.client.sendCommand(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],30000) else return 0 end",'1',`haven:v1:lease:${part(characterId)}`,token]))===1;}
  async releaseCharacter(characterId:string,token:string){await this.client.sendCommand(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",'1',`haven:v1:lease:${part(characterId)}`,token]);}
  async presence(characterId:string,channel:string){await this.client.sendCommand(['SET',`haven:v1:presence:${part(characterId)}`,JSON.stringify({channel:part(channel)}),'EX','45']);}
  async rateLimit(subject:string,limit:number,seconds:number){
    if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(seconds)||seconds<1)throw Error('Invalid rate limit');
    const count=Number(await this.client.sendCommand(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",'1',`haven:v1:rate:${part(subject)}`,String(seconds)]));return count<=limit;
  }
}
