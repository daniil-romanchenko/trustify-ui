import type React from "react";
import { renderHook } from "@testing-library/react";
import { type MockedFunction, describe, expect, it, vi } from "vitest";

import { useFetchSbomPermissions } from "@app/queries/sboms";

import {
  type IPermissionsContext,
  PermissionsContext,
} from "./PermissionsContext";
import { useSbomPermissions } from "./useSbomPermissions";

vi.mock("@app/queries/sboms");

const mockedUseFetchSbomPermissions = useFetchSbomPermissions as MockedFunction<
  typeof useFetchSbomPermissions
>;

const context = (
  overrides: Partial<IPermissionsContext>,
): IPermissionsContext => ({
  isLoading: false,
  isScoped: false,
  hasPermission: () => true,
  groupsWith: () => [],
  ...overrides,
});

const renderWith = (
  permissions: IPermissionsContext,
  sbomPermissions?: Record<string, string[]>,
) => {
  mockedUseFetchSbomPermissions.mockReturnValue({
    permissions: sbomPermissions,
    isLoading: false,
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
  return renderHook(() => useSbomPermissions(["a", "b"]), { wrapper }).result
    .current;
};

describe("useSbomPermissions", () => {
  it("uses the global permissions, when not scoped", () => {
    const { hasSbomPermission } = renderWith(
      context({ hasPermission: (p) => p === "update.sbom" }),
    );

    expect(mockedUseFetchSbomPermissions).toHaveBeenLastCalledWith(
      ["a", "b"],
      false,
    );
    expect(hasSbomPermission("a", "update.sbom")).toBe(true);
    expect(hasSbomPermission("a", "delete.sbom")).toBe(false);
  });

  it("uses the permissions of each SBOM, when scoped", () => {
    const { hasSbomPermission } = renderWith(context({ isScoped: true }), {
      a: ["read.sbom", "update.sbom", "delete.sbom"],
      b: ["read.sbom"],
    });

    expect(mockedUseFetchSbomPermissions).toHaveBeenLastCalledWith(
      ["a", "b"],
      true,
    );
    expect(hasSbomPermission("a", "delete.sbom")).toBe(true);
    expect(hasSbomPermission("b", "delete.sbom")).toBe(false);
    expect(hasSbomPermission("b", "update.sbom")).toBe(false);
    // unknown SBOMs are not permitted
    expect(hasSbomPermission("c", "update.sbom")).toBe(false);
  });

  it("requires the global permission, too", () => {
    const { hasSbomPermission } = renderWith(
      context({ isScoped: true, hasPermission: () => false }),
      { a: ["update.sbom"] },
    );

    expect(hasSbomPermission("a", "update.sbom")).toBe(false);
  });

  it("permits nothing until the permissions are known, when scoped", () => {
    const { hasSbomPermission } = renderWith(context({ isScoped: true }));

    expect(hasSbomPermission("a", "update.sbom")).toBe(false);
  });
});
