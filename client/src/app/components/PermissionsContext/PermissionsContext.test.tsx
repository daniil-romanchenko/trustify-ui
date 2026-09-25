import React from "react";
import { render, screen } from "@testing-library/react";
import { type MockedFunction, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PermissionsContext } from "./PermissionsContext";
import { PermissionsProvider } from "./PermissionsProvider";

import * as meModule from "@app/queries/me";

vi.mock("@app/queries/me");

const mockedUseFetchMe = meModule.useFetchMe as MockedFunction<
  typeof meModule.useFetchMe
>;

const PermissionsConsumer: React.FC = () => {
  const { isScoped, hasPermission, groupsWith } =
    React.useContext(PermissionsContext);
  return (
    <div>
      <span data-testid="scoped">{String(isScoped)}</span>
      <span data-testid="create">{String(hasPermission("create.sbom"))}</span>
      <span data-testid="delete">{String(hasPermission("delete.sbom"))}</span>
      <span data-testid="groups">{groupsWith("create.sbom").join(",")}</span>
    </div>
  );
};

const renderWithProvider = () => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PermissionsProvider>
        <PermissionsConsumer />
      </PermissionsProvider>
    </QueryClientProvider>,
  );
};

describe("PermissionsContext", () => {
  it("uses the effective permissions and groups", () => {
    mockedUseFetchMe.mockReturnValue({
      me: {
        permissions: ["create.sbom", "delete.sbom"],
        effectivePermissions: ["create.sbom"],
        access: [],
        scoped: true,
        groups: [
          { id: "a", permissions: ["create.sbom", "read.sbom"] },
          { id: "b", permissions: ["read.sbom"] },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderWithProvider();

    expect(screen.getByTestId("scoped")).toHaveTextContent("true");
    expect(screen.getByTestId("create")).toHaveTextContent("true");
    expect(screen.getByTestId("delete")).toHaveTextContent("false");
    expect(screen.getByTestId("groups")).toHaveTextContent("a");
  });

  it("permits everything when the permissions are unknown", () => {
    mockedUseFetchMe.mockReturnValue({
      me: undefined,
      isLoading: false,
      error: new Error("not found"),
    });

    renderWithProvider();

    expect(screen.getByTestId("scoped")).toHaveTextContent("false");
    expect(screen.getByTestId("create")).toHaveTextContent("true");
    expect(screen.getByTestId("delete")).toHaveTextContent("true");
  });
});
