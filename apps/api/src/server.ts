import {app,env,logger} from './app.js';
const server=app.listen(env.API_PORT,()=>logger.info({port:env.API_PORT},'MailForge API listening'));
let closing=false;const shutdown=(signal:string)=>{if(closing)return;closing=true;logger.info({signal},'Shutting down API');server.close(error=>{if(error){logger.error({err:error},'API shutdown failed');process.exitCode=1}})};
process.on('SIGINT',()=>shutdown('SIGINT'));process.on('SIGTERM',()=>shutdown('SIGTERM'));
