var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const method = request.method.toUpperCase();
    const R2_BUCKET_PUBLIC = env.R2_BUCKET_PUBLIC;
    const R2_BUCKET_PRIVATE = env.R2_BUCKET_PRIVATE;
    const R2_BUCKET_SOURCES = env.R2_BUCKET_SOURCES;
    const R2_BUCKET_PROMOS = env.R2_BUCKET_PROMOS;
    const AUTH_KEY = env.AUTH_KEY;
    const SIGNING_SECRET_BASE64 = env.SIGNING_SECRET_BASE64;
    const SIGNED_URL_TTL_SECONDS = Number(env.SIGNED_URL_TTL_SECONDS || 300);
    const CACHE_CONTROL_PUBLIC = env.CACHE_CONTROL_PUBLIC || "public, max-age=31536000, immutable";
    const CACHE_CONTROL_PRIVATE = env.CACHE_CONTROL_PRIVATE || "private, max-age=60, must-revalidate";
    let bucket;
    let isPublic = true;
    console.log("DEBUG: hostname=", url.hostname, "path=", path, "method=", method, "hasListParam=", url.searchParams.has("list"));
    if (url.hostname.startsWith("public") || url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      bucket = R2_BUCKET_PUBLIC;
      isPublic = true;
      console.log("DEBUG: Matched PUBLIC bucket, isPublic=true");
    } else if (url.hostname.startsWith("private")) {
      bucket = R2_BUCKET_PRIVATE;
      isPublic = false;
      console.log("DEBUG: Matched PRIVATE bucket, isPublic=false");
    } else if (url.hostname.startsWith("sources")) {
      bucket = R2_BUCKET_SOURCES;
      isPublic = true;
    } else if (url.hostname.startsWith("promos")) {
      bucket = R2_BUCKET_PROMOS;
      isPublic = true;
    } else {
      return new Response("Unknown host", { status: 400 });
    }
    function base64urlToUint8Array(b64url) {
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? "=".repeat(4 - b64.length % 4) : "";
      const bin = atob(b64 + pad);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }
    __name(base64urlToUint8Array, "base64urlToUint8Array");
    async function verifySignedToken(token) {
      if (!token) return false;
      const parts = token.split(":");
      if (parts.length !== 2) return false;
      const [expStr, sigB64url] = parts;
      const exp = parseInt(expStr, 10);
      if (isNaN(exp) || exp < Math.floor(Date.now() / 1e3)) return false;
      const msg = new TextEncoder().encode(String(exp));
      try {
        const keyBytes = base64urlToUint8Array(SIGNING_SECRET_BASE64.replace(/=/g, ""));
        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          keyBytes,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const sigBytes = base64urlToUint8Array(sigB64url);
        const ok = await crypto.subtle.verify("HMAC", cryptoKey, sigBytes, msg);
        return ok;
      } catch (e) {
        return false;
      }
    }
    __name(verifySignedToken, "verifySignedToken");
    if (!isPublic && ["PUT", "DELETE"].includes(method)) {
      const key = request.headers.get("X-Auth-Key");
      if (!AUTH_KEY || key !== AUTH_KEY) {
        return new Response("Forbidden", { status: 403 });
      }
    }
    try {
      switch (method) {
        case "GET": {
          if (url.searchParams.has("list")) {
            if (!isPublic && AUTH_KEY) {
              const key = request.headers.get("X-Auth-Key");
              if (key !== AUTH_KEY) {
                return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
                  status: 403,
                  headers: { "Content-Type": "application/json" }
                });
              }
            }
            const prefix = url.searchParams.get("prefix") || "";
            const maxKeys = parseInt(url.searchParams.get("maxKeys") || "1000", 10);
            const listed = await bucket.list({ prefix, limit: maxKeys });
            const objects = listed.objects.map((obj) => ({
              Key: obj.key,
              Size: obj.size,
              LastModified: obj.uploaded ? obj.uploaded.toISOString() : null,
              ETag: obj.etag || null
            }));
            return new Response(JSON.stringify({
              success: true,
              objects,
              count: objects.length,
              truncated: listed.truncated
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
              }
            });
          }
          if (!isPublic && !url.searchParams.has("list")) {
            const token = url.searchParams.get("t");
            const ok = await verifySignedToken(token);
            if (!ok) return new Response("Unauthorized", { status: 401 });
          }
          const object = await bucket.get(path);
          if (!object) return new Response("Not found", { status: 404 });
          const contentType = object.httpMetadata?.contentType || "application/octet-stream";
          const headers = new Headers();
          headers.set("Content-Type", contentType);
          headers.set("Cache-Control", isPublic ? CACHE_CONTROL_PUBLIC : CACHE_CONTROL_PRIVATE);
          if (object.httpMetadata?.etag) headers.set("ETag", object.httpMetadata.etag);
          if (object.httpMetadata?.lastModified) headers.set("Last-Modified", object.httpMetadata.lastModified);
          return new Response(object.body, { status: 200, headers });
        }
        case "PUT": {
          await bucket.put(path, request.body, {
            httpMetadata: {
              contentType: request.headers.get("content-type") || "application/octet-stream"
            }
          });
          return new Response("Uploaded", { status: 200 });
        }
        case "DELETE": {
          await bucket.delete(path);
          return new Response("Deleted", { status: 200 });
        }
        default:
          return new Response("Method Not Allowed", { status: 405 });
      }
    } catch (err) {
      return new Response("Error: " + (err?.message || String(err)), { status: 500 });
    }
  }
};

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-izSVnJ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-izSVnJ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
