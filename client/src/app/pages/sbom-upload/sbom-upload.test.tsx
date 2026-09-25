import { render, screen } from "@testing-library/react";
import { type MockedFunction, describe, expect, it, vi } from "vitest";

import { MemoryRouter } from "react-router-dom";

import {
  type IPermissionsContext,
  PermissionsContext,
} from "@app/components/PermissionsContext";
import { ReadOnlyContext } from "@app/components/ReadOnlyContext";
import { useFetchSBOMGroups } from "@app/queries/sbom-groups";
import { useUploadSBOM } from "@app/queries/sboms";

import { SbomUpload } from "./sbom-upload";

vi.mock("@app/queries/sboms");
vi.mock("@app/queries/sbom-groups");

const mockedUseUploadSBOM = useUploadSBOM as MockedFunction<
  typeof useUploadSBOM
>;
const mockedUseFetchSBOMGroups = useFetchSBOMGroups as MockedFunction<
  typeof useFetchSBOMGroups
>;

const unrestricted: IPermissionsContext = {
  isLoading: false,
  isScoped: false,
  hasPermission: () => true,
  groupsWith: () => [],
};

const renderPage = (permissions: IPermissionsContext = unrestricted) => {
  mockedUseUploadSBOM.mockReturnValue({
    uploads: new Map(),
    handleUpload: vi.fn(),
    handleRemoveUpload: vi.fn(),
  } as unknown as ReturnType<typeof useUploadSBOM>);
  mockedUseFetchSBOMGroups.mockReturnValue({
    result: {
      data: [
        { id: "a", name: "Payments" },
        { id: "b", name: "Other team" },
      ],
      total: 2,
    },
  } as unknown as ReturnType<typeof useFetchSBOMGroups>);

  return render(
    <MemoryRouter>
      <ReadOnlyContext.Provider
        value={{ isLoading: false, areMutationsDisabled: false }}
      >
        <PermissionsContext.Provider value={permissions}>
          <SbomUpload />
        </PermissionsContext.Provider>
      </ReadOnlyContext.Provider>
    </MemoryRouter>,
  );
};

describe("SbomUpload", () => {
  it("offers uploading without choosing a group, when not scoped", () => {
    renderPage();

    expect(screen.queryByLabelText("Group to upload into")).toBeNull();
  });

  it("requires choosing a group, when access is scoped", () => {
    renderPage({
      ...unrestricted,
      isScoped: true,
      groupsWith: (permission) => (permission === "create.sbom" ? ["a"] : []),
    });

    const select = screen.getByLabelText("Group to upload into");
    expect(select).toBeInTheDocument();
    // only groups the user may upload into are offered
    expect(
      screen.getByRole("option", { name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Other team" })).toBeNull();
    // no group is used for uploads until one was chosen
    expect(mockedUseUploadSBOM).toHaveBeenLastCalledWith(undefined);
  });

  it("tells the user when uploading isn't permitted", () => {
    renderPage({ ...unrestricted, hasPermission: () => false });

    expect(screen.getByText("Uploads not permitted")).toBeInTheDocument();
  });
});
