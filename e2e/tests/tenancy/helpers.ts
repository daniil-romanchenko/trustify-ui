import { randomUUID } from "node:crypto";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import {
  ORCHESTRATOR_CLIENT_ID,
  ORCHESTRATOR_CLIENT_SECRET,
  TENANCY_API_URL,
  TENANCY_AUTH_URL,
  USER_CLIENT_ID,
  USER_PASSWORD,
} from "./config";

const tokenEndpoint = async (request: APIRequestContext) => {
  const response = await request.get(
    `${TENANCY_AUTH_URL}/.well-known/openid-configuration`,
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token_endpoint as string;
};

const requestToken = async (
  request: APIRequestContext,
  form: Record<string, string>,
) => {
  const response = await request.post(await tokenEndpoint(request), { form });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).access_token as string;
};

/** Token of the orchestration platform, which has unrestricted access. */
export const orchestratorToken = (request: APIRequestContext) =>
  requestToken(request, {
    grant_type: "client_credentials",
    client_id: ORCHESTRATOR_CLIENT_ID,
    client_secret: ORCHESTRATOR_CLIENT_SECRET,
  });

export const userToken = (request: APIRequestContext, username: string) =>
  requestToken(request, {
    grant_type: "password",
    client_id: USER_CLIENT_ID,
    username,
    password: USER_PASSWORD,
  });

/** Calls the Trustify API with a bearer token. */
export class Api {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  get(path: string) {
    return this.request.get(`${TENANCY_API_URL}${path}`, {
      headers: this.headers(),
    });
  }

  put(path: string, data: unknown) {
    return this.request.put(`${TENANCY_API_URL}${path}`, {
      headers: this.headers(),
      data,
    });
  }

  post(path: string, data: unknown) {
    return this.request.post(`${TENANCY_API_URL}${path}`, {
      headers: this.headers(),
      data,
    });
  }

  delete(path: string) {
    return this.request.delete(`${TENANCY_API_URL}${path}`, {
      headers: this.headers(),
    });
  }

  async json<T = unknown>(path: string): Promise<T> {
    const response = await this.get(path);
    expect(response.ok(), `GET ${path}: ${response.status()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  /** Upload an SBOM into a group, returning the response. */
  upload(sbom: object, group?: string) {
    const query = group ? `?group=${encodeURIComponent(group)}` : "";
    return this.request.post(`${TENANCY_API_URL}/api/v3/sbom${query}`, {
      headers: this.headers({ "Content-Type": "application/json" }),
      data: JSON.stringify(sbom),
    });
  }
}

/** The ID of an ingested document, in the `urn:uuid:` form the SBOM endpoints expect. */
export const ingestedId = async (
  response: Awaited<ReturnType<Api["upload"]>>,
) => {
  expect(response.ok(), await response.text()).toBeTruthy();
  const { id } = (await response.json()) as { id: string };
  return id;
};

/** A minimal CycloneDX SBOM, unique for each call, so that it isn't shared with other tests. */
export const cyclonedx = (name: string) => ({
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name,
      version: "1.0.0",
      "bom-ref": "app",
      purl: `pkg:generic/${name}@1.0.0`,
    },
  },
  components: [
    {
      type: "library",
      name: "lodash",
      version: "4.17.20",
      "bom-ref": "lodash",
      purl: "pkg:npm/lodash@4.17.20",
    },
  ],
  dependencies: [{ ref: "app", dependsOn: ["lodash"] }],
});

/** Sign in to the UI through the OIDC provider's login form. */
export const signIn = async (page: Page, username: string) => {
  await page.goto("/sboms");
  await page.fill('input[name="username"]:visible', username);
  await page.fill('input[name="password"]:visible', USER_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "SBOMs" })).toBeVisible();
};
