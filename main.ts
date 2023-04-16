import { Application, Router, send } from "https://deno.land/x/oak/mod.ts";
import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.183.0/crypto/mod.ts";
import { toHashString } from "https://deno.land/std@0.183.0/crypto/to_hash_string.ts";

const app = new Application();
const io = new Server();
const router = new Router();


router
  .get("/", (ctx) => {
    ctx.response.headers.set("Content-Type", "text/html");
    const stream = Deno.create("index.html")

  })
  .get("/token", (ctx) => {
    const ts = new Date().getTime();
    const rand = Math.floor(Math.random() * 9999999);
    const secret = ts.toString() + rand.toString();
    ctx.response.body({ secret: secret, socketId: createHash(secret) });
  });

const createHash = async (secret) => {
  const cipher = await crypto.subtle.digest("SHAKE128", secret);
  return toHashString(cipher);
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

app.use(router.routes());
app.use(router.allowedMethods());

const handler = io.handler(async (req) => {
  return await app.handle(req) || new Response(null, { status: 404 });
});

await serve(handler, {
  port: 8000,
});
