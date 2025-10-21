export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const method = request.method.toUpperCase();

    // Config from bindings/env
    const PUBLIC_BUCKET = env.PUBLIC_BUCKET;
    const PRIVATE_BUCKET = env.PRIVATE_BUCKET;
    const AUTH_KEY = env.AUTH_KEY;
    const SIGNING_SECRET_BASE64 = env.SIGNING_SECRET_BASE64;
    const SIGNED_URL_TTL_SECONDS = Number(env.SIGNED_URL_TTL_SECONDS || 300);
    const CACHE_CONTROL_PUBLIC = env.CACHE_CONTROL_PUBLIC || "public, max-age=31536000, immutable";
    const CACHE_CONTROL_PRIVATE = env.CACHE_CONTROL_PRIVATE || "private, max-age=60, must-revalidate";

    // Determine bucket and access mode
    const isPublic =
      url.hostname.startsWith("public") ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost";
    const bucket = isPublic ? PUBLIC_BUCKET : PRIVATE_BUCKET;

    function base64urlToUint8Array(b64url) {
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
      const bin = atob(b64 + pad);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }

    async function verifySignedToken(token) {
      if (!token) return false;
      const parts = token.split(":");
      if (parts.length !== 2) return false;
      const [expStr, sigB64url] = parts;
      const exp = parseInt(expStr, 10);
      if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;
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

    // Protect writes to private bucket
    if (!isPublic && ["PUT", "DELETE"].includes(method)) {
      const key = request.headers.get("X-Auth-Key");
      if (!AUTH_KEY || key !== AUTH_KEY) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    try {
      switch (method) {
        case "GET": {
          if (!isPublic) {
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