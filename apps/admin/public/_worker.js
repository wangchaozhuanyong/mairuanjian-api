/* global Headers, Request, Response, URL, fetch */

const STATIC_ASSET_PATTERN =
  /\.(?:avif|css|eot|gif|ico|jpeg|jpg|js|json|map|mjs|png|svg|ttf|txt|webmanifest|webp|woff|woff2)$/i;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function buildUpstreamUrl(requestUrl, apiOrigin) {
  const source = new URL(requestUrl);
  const origin = new URL(apiOrigin);
  const basePath = origin.pathname === '/' ? '' : origin.pathname.replace(/\/$/, '');
  const target = new URL(origin.origin);

  target.pathname = `${basePath}${source.pathname}`;
  target.search = source.search;

  return target;
}

function isStaticAssetRequest(url) {
  return url.pathname.startsWith('/assets/') || STATIC_ASSET_PATTERN.test(url.pathname);
}

function withHeaders(response, headers) {
  const nextHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(headers)) {
    nextHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders
  });
}

function plainResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function fetchStaticAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || contentType.toLowerCase().startsWith('text/html')) {
    return plainResponse('Static asset not found.', 404);
  }

  return withHeaders(response, {
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff'
  });
}

async function fetchAdminPage(request, env) {
  const response = await env.ASSETS.fetch(request);
  const pageResponse =
    response.status === 404
      ? await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
      : response;
  const contentType = pageResponse.headers.get('content-type') ?? '';

  return withHeaders(pageResponse, {
    'cache-control': contentType.toLowerCase().startsWith('text/html')
      ? 'public, max-age=0, must-revalidate'
      : 'no-cache',
    'x-content-type-options': 'nosniff'
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return isStaticAssetRequest(url)
        ? fetchStaticAsset(request, env)
        : fetchAdminPage(request, env);
    }

    if (!env.API_ORIGIN) {
      return jsonResponse(
        {
          success: false,
          message: '后端 API 地址还没有配置，请先设置 Cloudflare Pages 的 API_ORIGIN。'
        },
        503
      );
    }

    const target = buildUpstreamUrl(request.url, env.API_ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', url.host);
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

    return fetch(target, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual'
    });
  }
};
