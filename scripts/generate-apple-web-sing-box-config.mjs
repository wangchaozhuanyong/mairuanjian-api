#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { createDecipheriv, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();
const outputPath = process.env.APPLE_WEB_SING_BOX_CONFIG_PATH || '.runtime/apple-web-sing-box.json';
const listenHost = process.env.APPLE_WEB_SING_BOX_LISTEN_HOST || '127.0.0.1';
const listenPort = Number(process.env.APPLE_WEB_SING_BOX_LISTEN_PORT || 2080);
const controller = process.env.APPLE_WEB_SING_BOX_CONTROLLER || '127.0.0.1:9090';
const selectorTag = process.env.APPLE_WEB_CHECK_SING_BOX_SELECTOR || 'apple-web';
const controllerSecret =
  process.env.APPLE_WEB_CHECK_SING_BOX_API_SECRET ||
  process.env.APPLE_WEB_SING_BOX_API_SECRET ||
  '';

function decrypt(value) {
  if (!value) return null;
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Unsupported encrypted field format');
  }
  const key = createHash('sha256')
    .update(process.env.FIELD_ENCRYPTION_KEY || 'development-field-key')
    .digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function decodeBase64Loose(value) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(
      normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='),
      'base64'
    ).toString('utf8');
  } catch {
    return null;
  }
}

function parsePort(value, fallback = 443) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function parseVmess(tag, raw) {
  const decoded = decodeBase64Loose(raw.replace(/^vmess:\/\//i, ''));
  if (!decoded) return null;
  const data = JSON.parse(decoded);
  const outbound = {
    type: 'vmess',
    tag,
    server: data.add,
    server_port: parsePort(data.port),
    uuid: data.id,
    security: data.scy || data.security || 'auto',
    alter_id: Number(data.aid || 0)
  };
  if (data.tls === 'tls') {
    outbound.tls = {
      enabled: true,
      server_name: data.sni || data.host || data.add
    };
  }
  if (data.net === 'ws') {
    outbound.transport = {
      type: 'ws',
      path: data.path || '/',
      headers: data.host ? { Host: data.host } : undefined
    };
  }
  return outbound;
}

function parseTrojan(tag, raw) {
  const url = new URL(raw);
  return {
    type: 'trojan',
    tag,
    server: url.hostname,
    server_port: parsePort(url.port),
    password: decodeURIComponent(url.username),
    tls: {
      enabled: true,
      server_name: url.searchParams.get('sni') || url.hostname
    }
  };
}

function parseVless(tag, raw) {
  const url = new URL(raw);
  const security = url.searchParams.get('security');
  const outbound = {
    type: 'vless',
    tag,
    server: url.hostname,
    server_port: parsePort(url.port),
    uuid: decodeURIComponent(url.username)
  };
  if (security === 'tls' || security === 'reality') {
    outbound.tls = {
      enabled: true,
      server_name: url.searchParams.get('sni') || url.searchParams.get('serverName') || url.hostname
    };
    if (security === 'reality') {
      outbound.tls.reality = {
        enabled: true,
        public_key: url.searchParams.get('pbk') || url.searchParams.get('publicKey') || undefined,
        short_id: url.searchParams.get('sid') || url.searchParams.get('shortId') || undefined
      };
    }
  }
  if (url.searchParams.get('type') === 'ws') {
    outbound.transport = {
      type: 'ws',
      path: url.searchParams.get('path') || '/',
      headers: url.searchParams.get('host') ? { Host: url.searchParams.get('host') } : undefined
    };
  }
  return outbound;
}

function parseShadowsocks(tag, raw) {
  const hashIndex = raw.indexOf('#');
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const body = withoutHash.replace(/^ss:\/\//i, '');
  const decodedBody = body.includes('@') ? body : decodeBase64Loose(body);
  if (!decodedBody) return null;
  const [userinfo, serverPart] = decodedBody.split('@');
  if (!userinfo || !serverPart) return null;
  const decodedUserInfo = userinfo.includes(':') ? userinfo : decodeBase64Loose(userinfo);
  if (!decodedUserInfo) return null;
  const [method, ...passwordParts] = decodedUserInfo.split(':');
  const [server, port] = serverPart.split(':');
  return {
    type: 'shadowsocks',
    tag,
    server,
    server_port: parsePort(port, 8388),
    method,
    password: passwordParts.join(':')
  };
}

function parseHysteria2(tag, raw) {
  const url = new URL(raw.replace(/^hy2:\/\//i, 'hysteria2://'));
  return {
    type: 'hysteria2',
    tag,
    server: url.hostname,
    server_port: parsePort(url.port),
    password: decodeURIComponent(url.username),
    tls: {
      enabled: true,
      server_name: url.searchParams.get('sni') || url.hostname
    }
  };
}

function toOutbound(node, raw) {
  if (raw.startsWith('vmess://')) return parseVmess(node.id, raw);
  if (raw.startsWith('trojan://')) return parseTrojan(node.id, raw);
  if (raw.startsWith('vless://')) return parseVless(node.id, raw);
  if (raw.startsWith('ss://')) return parseShadowsocks(node.id, raw);
  if (raw.startsWith('hysteria2://') || raw.startsWith('hy2://'))
    return parseHysteria2(node.id, raw);
  return null;
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => [key, compact(item)])
  );
}

async function main() {
  if (!Number.isInteger(listenPort) || listenPort <= 0 || listenPort > 65535) {
    throw new Error('APPLE_WEB_SING_BOX_LISTEN_PORT must be a valid port');
  }

  const parameter = await prisma.systemParameter.findUnique({
    where: { key: 'apple_web_gateway_nodes' }
  });
  const items = Array.isArray(parameter?.value?.items) ? parameter.value.items : [];
  const outbounds = [];
  const unsupported = [];

  for (const node of items) {
    if (!node?.id || !node?.rawEncrypted || node.status === 'unavailable') continue;
    const raw = decrypt(node.rawEncrypted);
    if (!raw) continue;
    try {
      const outbound = toOutbound(node, raw);
      if (outbound) {
        outbounds.push(compact(outbound));
      } else {
        unsupported.push(node.id);
      }
    } catch {
      unsupported.push(node.id);
    }
  }

  if (!outbounds.length) {
    throw new Error('No supported Apple web gateway nodes found');
  }

  const config = {
    log: {
      level: process.env.APPLE_WEB_SING_BOX_LOG_LEVEL || 'info'
    },
    inbounds: [
      {
        type: 'mixed',
        tag: 'apple-web-mixed-in',
        listen: listenHost,
        listen_port: listenPort
      }
    ],
    outbounds: [
      {
        type: 'selector',
        tag: selectorTag,
        outbounds: outbounds.map((item) => item.tag),
        default: outbounds[0].tag
      },
      ...outbounds,
      {
        type: 'direct',
        tag: 'direct'
      }
    ],
    route: {
      final: selectorTag
    },
    experimental: {
      clash_api: {
        external_controller: controller,
        secret: controllerSecret
      }
    }
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(compact(config), null, 2)}\n`);
  console.log(
    `Generated Apple web sing-box config: ${outputPath}; outbounds=${outbounds.length}; unsupported=${unsupported.length}`
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Failed to generate sing-box config');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
