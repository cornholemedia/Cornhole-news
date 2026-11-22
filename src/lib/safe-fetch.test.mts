import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { fetchPublicHtml, readResponseText } from "./safe-fetch.ts";

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(address.port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

test("an already aborted signal fails before any network wait", async () => {
  const controller = new AbortController();
  controller.abort();
  const started = Date.now();
  await assert.rejects(
    () => fetchPublicHtml("https://example.com/", controller.signal),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    }
  );
  assert.ok(Date.now() - started < 500);
});

test("readResponseText returns a finished HTML body", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><title>Hello</title></html>");
  });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const html = await readResponseText(response, AbortSignal.timeout(2_000), 10_000);
    assert.match(html, /Hello/);
  } finally {
    await close(server);
  }
});

test("a page that never finishes its body stops when the signal aborts", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.write("<html><head><title>Partial");
  });
  const port = await listen(server);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 200);
  const started = Date.now();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    await assert.rejects(
      () => readResponseText(response, controller.signal, 1_000_000),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.name, "AbortError");
        return true;
      }
    );
    assert.ok(Date.now() - started < 1_500);
  } finally {
    clearTimeout(timer);
    await close(server);
  }
});
