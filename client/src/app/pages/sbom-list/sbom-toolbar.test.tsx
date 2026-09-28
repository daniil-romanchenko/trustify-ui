import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryRouter } from "react-router-dom";

import {
  type IPermissionsContext,
  PermissionsContext,
} from "@app/components/PermissionsContext";
import { ReadOnlyContext } from "@app/components/ReadOnlyContext";
import { useFetchSbomPermissions } from "@app/queries/sboms";
import { SbomSearchContext } from "./sbom-context";

import { SbomToolbar } from "./sbom-toolbar";

vi.mock("@app/queries/sbom-groups", () => ({
  useFetchSbomGroups: vi.fn().mockReturnValue({ result: { data: [] } }),
}));

vi.mock("@app/queries/recommendations", () => ({
  useIsRecommendationEnabled: () => true,
}));

vi.mock("@app/queries/sboms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@app/queries/sboms")>()),
  useFetchSbomPermissions: vi.fn(),
}));

const mockedUseFetchSbomPermissions = vi.mocked(useFetchSbomPermissions);
mockedUseFetchSbomPermissions.mockReturnValue({
  permissions: undefined,
  isLoading: false,
});

const unrestricted: IPermissionsContext = {
  isLoading: false,
  isScoped: false,
  hasPermission: () => true,
  groupsWith: () => [],
};

const makeControls = (selectedIds: string[] = []) => ({
  tableControls: {
    propHelpers: {
      toolbarProps: {},
      filterToolbarProps: {},
      paginationToolbarItemProps: {},
      paginationProps: {},
    },
  } as never,
  bulkSelection: {
    isEnabled: false,
    controls: {
      selectedItems: selectedIds.map((id) => ({ id })),
      propHelpers: { toolbarBulkSelectorProps: {} },
    },
  } as never,
});

const renderToolbar = (
  selectedIds: string[] = [],
  permissions: IPermissionsContext = unrestricted,
) =>
  render(
    <MemoryRouter>
      <ReadOnlyContext.Provider
        value={{ isLoading: false, areMutationsDisabled: false }}
      >
        <PermissionsContext.Provider value={permissions}>
          <SbomSearchContext.Provider
            value={makeControls(selectedIds) as never}
          >
            <SbomToolbar showActions />
          </SbomSearchContext.Provider>
        </PermissionsContext.Provider>
      </ReadOnlyContext.Provider>
    </MemoryRouter>,
  );

describe("SbomToolbar – Add to group button", () => {
  it("is enabled when all selected SBOMs may be updated", () => {
    renderToolbar(["id-1", "id-2"]);

    expect(screen.getByRole("button", { name: "Add to group" })).toBeEnabled();
  });

  it("is disabled when a selected SBOM may not be updated, when scoped", () => {
    mockedUseFetchSbomPermissions.mockReturnValueOnce({
      permissions: {
        "id-1": ["read.sbom", "update.sbom"],
        "id-2": ["read.sbom"],
      },
      isLoading: false,
    });
    renderToolbar(["id-1", "id-2"], { ...unrestricted, isScoped: true });

    expect(screen.getByRole("button", { name: "Add to group" })).toBeDisabled();
  });
});

describe("SbomToolbar – Generate remediation report button", () => {
  it("is disabled when no SBOMs are selected", () => {
    // Given the toolbar with no selection
    renderToolbar([]);

    // Then the button is present but disabled
    const btn = screen.getByRole("button", {
      name: /Generate remediation report/i,
    });
    expect(btn).toBeDisabled();
  });

  it("is enabled when one or more SBOMs are selected within the limit", () => {
    // Given the toolbar with 3 SBOMs selected (below the cap)
    renderToolbar(["id-1", "id-2", "id-3"]);

    // Then the button is enabled
    const btn = screen.getByRole("button", {
      name: /Generate remediation report/i,
    });
    expect(btn).not.toBeDisabled();
  });

  it("is aria-disabled with a tooltip when selection exceeds the configured limit", () => {
    // Given the toolbar with more SBOMs selected than the max allowed
    const ids = Array.from({ length: 11 }, (_, i) => `id-${i}`);
    renderToolbar(ids);

    // Then the button is aria-disabled (rendered via Tooltip + isAriaDisabled)
    const btn = screen.getByRole("button", {
      name: /Generate remediation report/i,
    });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });
});
