// @ts-check

import { expect, test, type APIRequestContext } from "@playwright/test";

import { emailOf, USERS } from "./config";
import {
  Api,
  cyclonedx,
  ingestedId,
  orchestratorToken,
  signIn,
  userToken,
} from "./helpers";

/**
 * End-to-end tests of scoped authorization, driven like an orchestration platform would drive it:
 *
 * - `payments` (editor: editor, viewer: viewer)
 * - `web` (editor: viewer, uploader: uploader)
 */

type Group = { id: string; name: string };
type Me = {
  scoped: boolean;
  effectivePermissions?: string[];
  groups: { id: string; permissions: string[] }[];
};

const run = `e2e${Date.now().toString(36)}`;

const state = {
  payments: {} as Group,
  web: {} as Group,
  /** SBOM in the payments group */
  sbomPayments: { id: "", name: `${run}-payments-app` },
  /** SBOM in the web group */
  sbomWeb: { id: "", name: `${run}-web-app` },
};

const orchestrator = async (request: APIRequestContext) =>
  new Api(request, await orchestratorToken(request));

const user = async (request: APIRequestContext, username: string) =>
  new Api(request, await userToken(request, username));

test.describe.configure({ mode: "serial" });

test.describe("Scoped authorization", { tag: "@tenancy" }, () => {
  test.beforeAll(async ({ request }) => {
    const api = await orchestrator(request);

    // group hierarchy, addressed by external IDs
    for (const [key, body] of [
      [run, { name: run, kind: "organization" }],
      [`${run}.payments`, { name: `${run}-payments`, parent: `ext:${run}` }],
      [`${run}.web`, { name: `${run}-web`, parent: `ext:${run}` }],
    ] as const) {
      const response = await api.put(`/api/v3/group/sbom/ext:${key}`, body);
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    state.payments = await api.json<Group>(
      `/api/v3/group/sbom/ext:${run}.payments`,
    );
    state.web = await api.json<Group>(`/api/v3/group/sbom/ext:${run}.web`);

    // users, by e-mail, and their roles
    for (const username of Object.values(USERS)) {
      const response = await api.put(`/api/v3/user/${emailOf(username)}`, {
        displayName: username,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    }
    for (const [group, username, role] of [
      [`${run}.payments`, USERS.editor, "editor"],
      [`${run}.web`, USERS.editor, "viewer"],
      [`${run}.payments`, USERS.viewer, "viewer"],
      [`${run}.web`, USERS.uploader, "uploader"],
    ] as const) {
      const response = await api.put(
        `/api/v3/group/sbom/ext:${group}/binding/user/${emailOf(username)}`,
        { role },
      );
      expect(response.ok(), await response.text()).toBeTruthy();
    }

    state.sbomPayments.id = await ingestedId(
      await api.upload(cyclonedx(state.sbomPayments.name), state.payments.id),
    );
    state.sbomWeb.id = await ingestedId(
      await api.upload(cyclonedx(state.sbomWeb.name), state.web.id),
    );
  });

  test.describe("API", () => {
    test("/v3/me reports the groups and their permissions", async ({
      request,
    }) => {
      const me = await (
        await user(request, USERS.editor)
      ).json<Me>("/api/v3/me");

      expect(me.scoped).toBe(true);
      const payments = me.groups.find((g) => g.id === state.payments.id);
      const web = me.groups.find((g) => g.id === state.web.id);
      expect(payments?.permissions).toContain("delete.sbom");
      expect(web?.permissions).toContain("read.sbom");
      expect(web?.permissions).not.toContain("delete.sbom");
    });

    test("SBOM permissions depend on the SBOM's groups", async ({
      request,
    }) => {
      const ids = [state.sbomPayments.id, state.sbomWeb.id];
      const permissions = async (username: string) => {
        const response = await (
          await user(request, username)
        ).post("/api/v3/sbom-permissions", ids);
        expect(response.ok()).toBeTruthy();
        return (await response.json()) as Record<string, string[]>;
      };

      expect(await permissions(USERS.editor)).toEqual({
        [state.sbomPayments.id]: ["read.sbom", "update.sbom", "delete.sbom"],
        [state.sbomWeb.id]: ["read.sbom"],
      });
      expect(await permissions(USERS.viewer)).toEqual({
        [state.sbomPayments.id]: ["read.sbom"],
      });
      expect(await permissions(USERS.uploader)).toEqual({
        [state.sbomWeb.id]: ["read.sbom"],
      });
    });

    test("SBOMs of other groups don't exist for a user", async ({
      request,
    }) => {
      const viewer = await user(request, USERS.viewer);

      expect(
        (await viewer.get(`/api/v3/sbom/${state.sbomWeb.id}`)).status(),
      ).toBe(404);
      expect(
        (await viewer.get(`/api/v3/sbom/${state.sbomPayments.id}`)).status(),
      ).toBe(200);

      const list = await viewer.json<{ items: { name: string }[] }>(
        `/api/v3/sbom?q=${run}`,
      );
      expect(list.items.map((i) => i.name)).toEqual([state.sbomPayments.name]);
    });

    test("deleting an SBOM requires the editor role on its group", async ({
      request,
    }) => {
      const editor = await user(request, USERS.editor);

      // the editor is only a viewer of the web group: the SBOM must survive
      await editor.delete(`/api/v3/sbom/${state.sbomWeb.id}`);
      expect(
        (await editor.get(`/api/v3/sbom/${state.sbomWeb.id}`)).status(),
      ).toBe(200);
    });

    test("uploads are limited to groups with the uploader role", async ({
      request,
    }) => {
      const uploader = await user(request, USERS.uploader);

      const denied = await uploader.upload(
        cyclonedx(`${run}-denied`),
        state.payments.id,
      );
      expect(denied.ok()).toBeFalsy();

      // uploads without a group are rejected, when scoped
      const noGroup = await uploader.upload(cyclonedx(`${run}-no-group`));
      expect(noGroup.ok()).toBeFalsy();

      const id = await ingestedId(
        await uploader.upload(cyclonedx(`${run}-uploaded`), state.web.id),
      );
      expect((await uploader.get(`/api/v3/sbom/${id}`)).status()).toBe(200);

      // the viewer of payments doesn't see it
      const viewer = await user(request, USERS.viewer);
      expect((await viewer.get(`/api/v3/sbom/${id}`)).status()).toBe(404);
    });

    test("API keys can only upload into their groups", async ({ request }) => {
      const api = await orchestrator(request);
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
      const created = await api.post("/api/v3/api-key", {
        name: `${run} CI`,
        groups: [`ext:${run}.web`],
        expiresAt,
        externalId: `${run}.ci`,
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const { token } = (await created.json()) as { token: string };
      expect(token).toMatch(/^tfy_/);

      const key = new Api(request, token);
      const id = await ingestedId(await key.upload(cyclonedx(`${run}-ci`)));

      // uploaded into the key's group
      const assignments = await api.json<string[]>(
        `/api/v3/group/sbom-assignment/${id.replace(/^urn:uuid:/, "")}`,
      );
      expect(assignments).toEqual([state.web.id]);

      // keys can't upload elsewhere, or read
      expect(
        (await key.upload(cyclonedx(`${run}-ci-2`), state.payments.id)).ok(),
      ).toBeFalsy();
      expect((await key.get("/api/v3/sbom")).ok()).toBeFalsy();

      // revoked keys stop working
      expect(
        (await api.delete(`/api/v3/api-key/ext:${run}.ci`)).ok(),
      ).toBeTruthy();
      expect((await key.upload(cyclonedx(`${run}-ci-3`))).ok()).toBeFalsy();
    });

    test("changes are recorded in the audit log", async ({ request }) => {
      const api = await orchestrator(request);
      const response = await api.json<
        { items: { action: string }[] } | { action: string }[]
      >("/api/v3/audit?limit=200");
      const actions = (Array.isArray(response) ? response : response.items).map(
        (e) => e.action,
      );

      expect(actions).toEqual(expect.arrayContaining(["set-binding"]));
    });
  });

  test.describe("UI", () => {
    const rowOf = (page: import("@playwright/test").Page, name: string) =>
      page
        .locator('table[aria-label="sbom-table"] tbody')
        .filter({ has: page.getByRole("link", { name, exact: true }) });

    const openSbomList = async (page: import("@playwright/test").Page) => {
      await page.goto(`/sboms`);
      const filter = page
        .locator('[aria-label="sbom-toolbar"]')
        .getByPlaceholder("Search", { exact: true });
      await filter.fill(run);
      await filter.press("Enter");
      // wait for the filtered list, and the permissions of its SBOMs
      await expect(page.getByText(run, { exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
    };

    const rowActions = async (
      page: import("@playwright/test").Page,
      name: string,
    ) => {
      const row = rowOf(page, name);
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Kebab toggle" }).click();
      const items = await page.getByRole("menuitem").allInnerTexts();
      await page.keyboard.press("Escape");
      return items.map((i) => i.trim());
    };

    test("an editor only gets edit actions on SBOMs of its groups", async ({
      page,
    }) => {
      await signIn(page, USERS.editor);
      await openSbomList(page);

      const payments = await rowActions(page, state.sbomPayments.name);
      expect(payments).toEqual(
        expect.arrayContaining(["Edit labels", "Delete", "Download SBOM"]),
      );

      const web = await rowActions(page, state.sbomWeb.name);
      expect(web).toContain("Download SBOM");
      expect(web).not.toContain("Delete");
      expect(web).not.toContain("Edit labels");
    });

    test("SBOM details only offer deletion when permitted", async ({
      page,
    }) => {
      await signIn(page, USERS.editor);

      for (const [sbom, deletable] of [
        [state.sbomPayments, true],
        [state.sbomWeb, false],
      ] as const) {
        await page.goto(`/sboms/${sbom.id}`);
        await page.getByRole("button", { name: "Actions" }).click();
        await expect(
          page.getByRole("menuitem", { name: "Download SBOM" }),
        ).toBeVisible();
        await expect(
          page.getByRole("menuitem", { name: "Delete" }),
        ).toHaveCount(deletable ? 1 : 0);
        await page.keyboard.press("Escape");
      }
    });

    test("adding to a group requires update access to all selected SBOMs", async ({
      page,
    }) => {
      await signIn(page, USERS.editor);
      await openSbomList(page);
      const addToGroup = page.getByRole("button", { name: "Add to group" });

      const select = (name: string) =>
        rowOf(page, name).getByRole("checkbox").check();

      await expect(addToGroup).toBeDisabled();
      await select(state.sbomPayments.name);
      await expect(addToGroup).toBeEnabled();
      await select(state.sbomWeb.name);
      await expect(addToGroup).toBeDisabled();
    });

    test("a viewer gets no edit actions and can't upload", async ({ page }) => {
      await signIn(page, USERS.viewer);
      await openSbomList(page);

      await expect(rowOf(page, state.sbomWeb.name)).toHaveCount(0);
      const actions = await rowActions(page, state.sbomPayments.name);
      expect(actions).not.toContain("Delete");
      expect(actions).not.toContain("Edit labels");

      await page.goto("/sboms/upload");
      await expect(page.getByText("Uploads not permitted")).toBeVisible();
    });

    test("an uploader can only choose its groups for uploads", async ({
      page,
    }) => {
      await signIn(page, USERS.uploader);
      await page.goto("/sboms/upload");

      const select = page.getByLabel("Group to upload into");
      await expect(select).toBeVisible();
      await expect(
        select.getByRole("option", { name: state.web.name }),
      ).toHaveCount(1);
      await expect(
        select.getByRole("option", { name: state.payments.name }),
      ).toHaveCount(0);
      await expect(page.getByLabel("sbom-uploader")).toHaveCount(0);

      await select.selectOption({ label: state.web.name });
      await expect(page.getByLabel("sbom-uploader")).toBeVisible();
    });

    test("an editor can delete an SBOM of its group", async ({
      page,
      request,
    }) => {
      await signIn(page, USERS.editor);
      await openSbomList(page);

      await rowOf(page, state.sbomPayments.name)
        .getByRole("button", { name: "Kebab toggle" })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page
        .getByRole("dialog", { name: "Confirm dialog" })
        .getByRole("button", { name: "confirm" })
        .click();

      await expect(rowOf(page, state.sbomPayments.name)).toHaveCount(0);
      const api = await orchestrator(request);
      expect(
        (await api.get(`/api/v3/sbom/${state.sbomPayments.id}`)).status(),
      ).toBe(404);
    });
  });
});
