var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/publisher.ts
var publisher_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (url.pathname === "/health") {
        return jsonResponse({ status: "healthy" }, 200, corsHeaders);
      }
      if (url.pathname === "/api/publish" && request.method === "POST") {
        return await handlePublish(request, env, corsHeaders);
      }
      if (url.pathname === "/api/status" && request.method === "GET") {
        const episodeId = url.searchParams.get("episode_id");
        if (!episodeId) {
          return jsonResponse({ error: "Missing episode_id" }, 400, corsHeaders);
        }
        const status = await env.POST_STATUS.get(episodeId);
        if (!status) {
          return jsonResponse({ error: "Not found" }, 404, corsHeaders);
        }
        return jsonResponse(JSON.parse(status), 200, corsHeaders);
      }
      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      console.error("Error:", error);
      return jsonResponse({
        error: error instanceof Error ? error.message : "Unknown error"
      }, 500, corsHeaders);
    }
  },
  async scheduled(event, env) {
    console.log("Cron triggered at:", new Date(event.scheduledTime).toISOString());
  }
};
async function handlePublish(request, env, corsHeaders) {
  const episode = await request.json();
  if (!episode.episode_id || !episode.title) {
    return jsonResponse({ error: "Missing required fields" }, 400, corsHeaders);
  }
  await env.EPISODE_METADATA.put(episode.episode_id, JSON.stringify(episode));
  let twitterResult;
  try {
    twitterResult = await postToTwitter(episode, env);
  } catch (error) {
    console.error("Twitter posting failed:", error);
    twitterResult = {
      posted: false,
      error: error instanceof Error ? error.message : "Unknown error",
      platform: "twitter"
    };
  }
  const status = {
    episode_id: episode.episode_id,
    status: { twitter: twitterResult },
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await env.POST_STATUS.put(episode.episode_id, JSON.stringify(status));
  return jsonResponse({
    success: twitterResult.posted,
    episode_id: episode.episode_id,
    status: status.status
  }, 200, corsHeaders);
}
__name(handlePublish, "handlePublish");
async function postToTwitter(episode, env) {
  const content = buildTwitterPost(episode);
  const url = "https://api.twitter.com/2/tweets";
  const payload = { text: content };
  console.log("Posting to Twitter with OAuth 1.0a...");
  console.log("Content:", content);
  const authHeader = await buildOAuth1Header(
    "POST",
    url,
    payload,
    env.TWITTER_API_KEY,
    env.TWITTER_API_SECRET,
    env.TWITTER_ACCESS_TOKEN,
    env.TWITTER_ACCESS_TOKEN_SECRET
  );
  console.log("OAuth header built, posting...");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  console.log("Response status:", response.status);
  const responseText = await response.text();
  console.log("Response body:", responseText);
  if (!response.ok) {
    throw new Error(`Twitter API error (${response.status}): ${responseText}`);
  }
  const result = JSON.parse(responseText);
  console.log("\u2705 Tweet posted! ID:", result.data?.id);
  return {
    posted: true,
    post_id: result.data.id,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    platform: "twitter"
  };
}
__name(postToTwitter, "postToTwitter");
async function buildOAuth1Header(method, url, body, consumerKey, consumerSecret, accessToken, accessTokenSecret) {
  const timestamp = Math.floor(Date.now() / 1e3).toString();
  const nonce = generateNonce();
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: "1.0"
  };
  const allParams = {
    ...oauthParams,
    ...body
  };
  const paramString = Object.keys(allParams).sort().map((key) => `${encodeParam(key)}=${encodeParam(String(allParams[key]))}`).join("&");
  const signatureBase = [
    method.toUpperCase(),
    encodeParam(url),
    encodeParam(paramString)
  ].join("&");
  const signingKey = `${encodeParam(consumerSecret)}&${encodeParam(accessTokenSecret)}`;
  const signature = await hmacSha1(signingKey, signatureBase);
  oauthParams.oauth_signature = signature;
  const authorizationHeader = "OAuth " + Object.keys(oauthParams).sort().map((key) => `${encodeParam(key)}="${encodeParam(oauthParams[key])}"`).join(", ");
  return authorizationHeader;
}
__name(buildOAuth1Header, "buildOAuth1Header");
function encodeParam(str) {
  return encodeURIComponent(str).replace(/!/g, "%21").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}
__name(encodeParam, "encodeParam");
async function hmacSha1(key, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
__name(hmacSha1, "hmacSha1");
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(generateNonce, "generateNonce");
function buildTwitterPost(episode) {
  const primaryLink = episode.layer1_links.youtube || episode.layer1_links.spotify || "";
  const shortTitle = episode.title.substring(0, 100) + (episode.title.length > 100 ? "..." : "");
  const lines = [
    `\u{1F399}\uFE0F New AI-Now Episode!`,
    ``,
    shortTitle,
    ``,
    `\u{1F3A7} ${primaryLink}`,
    ``,
    `#AINow #AI #Podcast`
  ];
  const draft = lines.join("\n");
  if (draft.length > 280) {
    return draft.substring(0, 277) + "...";
  }
  return draft;
}
__name(buildTwitterPost, "buildTwitterPost");
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
__name(jsonResponse, "jsonResponse");
export {
  publisher_default as default
};
//# sourceMappingURL=publisher.js.map
