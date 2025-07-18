import {
  Application,
  Router,
  send,
} from "oak";
import { Server } from "socket.io";
import { serve } from "std/http/server.ts";
import { crypto } from "std/crypto/mod.ts";
import { encode } from "std/encoding/hex.ts";

const app = new Application();
const io = new Server();
const router = new Router();

router
  .get("/", async (ctx) => {
    await send(ctx, ctx.request.url.pathname, {
      root: `${Deno.cwd()}/static`,
      index: "index.html",
    });
  })
  .get("/token", async (ctx) => {
    const ts = new Date().getTime();
    const rand = Math.floor(Math.random() * 9999999);
    const secret = ts.toString() + rand.toString();
    ctx.response.body = { secret: secret, socketId: await createHash(secret) };
  });

const createHash = async (secret: string) => {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHAKE128", data);
  return new TextDecoder().decode(encode(new Uint8Array(hash)));
};

io.on("connection", (socket) => {
  socket.on("multiplex-statechanged", async (data) => {
    if (
      typeof data.secret == "undefined" || data.secret == null ||
      data.secret === ""
    ) return;
    if (await createHash(data.secret) === data.socketId) {
      data.secret = null;
      socket.broadcast.emit(data.socketId, data);
    }
  });
});

// Set CORS headers directly
app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, PUT, PATCH, POST, DELETE");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  
  await next();
})
app.use(router.routes());
app.use(router.allowedMethods());

const handler = io.handler(async (req) => {
  return await app.handle(req) || new Response(null, { status: 404 });
});

await serve(handler, {
  port: 8000,
});
