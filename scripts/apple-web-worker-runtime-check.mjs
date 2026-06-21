#!/usr/bin/env node
import { chromium } from 'playwright';

const defaultIpCheckUrls = [
  'https://ipapi.co/json/',
  'https://ipwho.is/',
  'https://api.country.is/'
];
const ipCheckUrls = Array.from(
  new Set(
    [process.env.APPLE_WEB_CHECK_IP_CHECK_URL, ...defaultIpCheckUrls].filter(
      (value) => typeof value === 'string' && value.trim()
    )
  )
);
const proxyServer = process.env.APPLE_WEB_CHECK_PROXY_SERVER || '';
const expectedCountry = (process.env.APPLE_WEB_CHECK_EXPECTED_COUNTRY || '').trim().toUpperCase();
const timeoutMs = Number(process.env.APPLE_WEB_CHECK_TIMEOUT_MS || 45000);

function normalizeCountry(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

function readCountry(data) {
  return (
    normalizeCountry(data.country_code) ||
    normalizeCountry(data.countryCode) ||
    normalizeCountry(data.country)
  );
}

async function main() {
  const startedAt = Date.now();
  const browser = await chromium.launch({
    headless: process.env.APPLE_WEB_CHECK_HEADLESS !== 'false',
    proxy: proxyServer ? { server: proxyServer } : undefined
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(Number.isFinite(timeoutMs) ? timeoutMs : 45000);
    let data = null;
    let country = null;
    let checkedUrl = null;

    for (const url of ipCheckUrls) {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
      const text = response ? await response.text() : ((await page.textContent('body')) ?? '{}');
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      country = data ? readCountry(data) : null;
      checkedUrl = url;
      if (country) break;
    }

    const latencyMs = Date.now() - startedAt;

    if (!country) {
      throw new Error('IP check did not return a country code from any configured endpoint');
    }

    if (expectedCountry && country !== expectedCountry) {
      throw new Error(`Exit country mismatch: expected=${expectedCountry}, actual=${country}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          country,
          expectedCountry: expectedCountry || null,
          checkedUrl,
          proxyConfigured: Boolean(proxyServer),
          ipDetected: Boolean(data?.ip),
          latencyMs
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Apple web runtime check failed');
  process.exitCode = 1;
});
