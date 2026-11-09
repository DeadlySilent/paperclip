import { createRequire } from "node:module";
import type { AddressInfo, Server } from "node:net";
import express from "express";
import request from "supertest";
import { expect, it, vi } from "vitest";

type SupertestTestInstance = {
  _server?: Server;
};

const require = createRequire(import.meta.url);
const SupertestTest = require("supertest/lib/test.js") as {
  prototype: {
    serverAddress(this: SupertestTestInstance, app: Server, path: string): string;
  };
};

it.each([
  ["::", "127.0.0.1"],
  ["0.0.0.0", "127.0.0.1"],
  ["127.0.0.2", "127.0.0.2"],
])("uses %s as the listener address and connects through %s", (address, host) => {
  const app = {
    address: () => ({ address, family: address === "::" ? "IPv6" : "IPv4", port: 43123 }),
  };

  expect(SupertestTest.prototype.serverAddress.call({}, app as unknown as Server, "/ping"))
    .toBe(`http://${host}:43123/ping`);
});

it("starts an unbound server on an ephemeral port and retains it for cleanup", () => {
  const listeningAddress: AddressInfo = { address: "::", family: "IPv6", port: 43124 };
  const app = {
    address: vi.fn<() => AddressInfo | null>()
      .mockReturnValueOnce(null)
      .mockReturnValue(listeningAddress),
    listen: vi.fn(),
  };
  app.listen.mockReturnValue(app);
  const test: SupertestTestInstance = {};

  expect(SupertestTest.prototype.serverAddress.call(test, app as unknown as Server, "/ping"))
    .toBe("http://127.0.0.1:43124/ping");
  expect(app.listen).toHaveBeenCalledExactlyOnceWith(0);
  expect(test._server).toBe(app);
});

it("reaches an in-memory Express app through the loopback address", async () => {
  const app = express();
  app.get("/ping", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const response = await request(app)
    .get("/ping")
    .timeout({ response: 5_000, deadline: 8_000 });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
});
