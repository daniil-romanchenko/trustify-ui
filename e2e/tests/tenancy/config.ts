/**
 * Configuration of the tenancy tests.
 *
 * These tests need a Trustify instance running with `TRUSTD_AUTHZ_MODE=scoped` and an OIDC provider
 * with:
 *
 * - a confidential client for the orchestration platform, whose tokens carry `manage.tenancy`
 * - a client allowing password grants for the test users
 * - test users with verified e-mail addresses and all global SBOM permissions (the role bindings
 *   created by the tests limit their access)
 */
export const TENANCY_API_URL =
  process.env.TENANCY_API_URL ??
  process.env.TRUSTIFY_API_URL ??
  "http://localhost:8080";

export const TENANCY_AUTH_URL =
  process.env.TENANCY_AUTH_URL ??
  process.env.PLAYWRIGHT_AUTH_URL ??
  "http://localhost:8090/realms/trustify";

export const ORCHESTRATOR_CLIENT_ID =
  process.env.TENANCY_ORCHESTRATOR_CLIENT_ID ?? "testing-manager";
export const ORCHESTRATOR_CLIENT_SECRET =
  process.env.TENANCY_ORCHESTRATOR_CLIENT_SECRET ??
  "R8A6KFeyxJsMDBhjfHbpZTIF0GWt43HP";

export const USER_CLIENT_ID = process.env.TENANCY_USER_CLIENT_ID ?? "e2e-cli";
export const USER_PASSWORD = process.env.TENANCY_USER_PASSWORD ?? "pass123456";
export const USER_EMAIL_DOMAIN =
  process.env.TENANCY_USER_EMAIL_DOMAIN ?? "example.com";

/** Usernames of the test users, their e-mail is `<username>@<domain>`. */
export const USERS = {
  /** editor of the payments group, viewer of the web group */
  editor: process.env.TENANCY_USER_EDITOR ?? "alice",
  /** viewer of the payments group */
  viewer: process.env.TENANCY_USER_VIEWER ?? "bob",
  /** uploader of the web group */
  uploader: process.env.TENANCY_USER_UPLOADER ?? "carol",
} as const;

export const emailOf = (username: string) => `${username}@${USER_EMAIL_DOMAIN}`;
