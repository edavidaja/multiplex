import {
  Application,
  Router,
  send,
} from "https://deno.land/x/oak@v12.1.0/mod.ts";
import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.183.0/crypto/mod.ts";
import { toHashString } from "https://deno.land/std@0.183.0/crypto/to_hash_string.ts";
import {oakCors} from "https://deno.land/x/cors@v1.2.2/mod.ts"

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
  return toHashString(hash);
};

io.on("connection", (socket) => {
  socket.on("multiplex-statechanged", (data) => {
    if (
      typeof data.secret == "undefined" || data.secret == null ||
      data.secret === ""
    ) return;
    if (createHash(data.secret) === data.socketId) {
      data.secret = null;
      socket.broadcast.emit(data.socketId, data);
    }
  });
});

app.use(oakCors({
  origin: "*",
  credentials: true,
}))
app.use(router.routes());
app.use(router.allowedMethods());

const handler = io.handler(async (req) => {
  return await app.handle(req) || new Response(null, { status: 404 });
});

await serve(handler, {
  port: 8000,
});
