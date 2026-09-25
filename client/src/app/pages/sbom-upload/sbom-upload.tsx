import React from "react";
import { Link } from "react-router-dom";

import type { AxiosResponse } from "axios";

import {
  Breadcrumb,
  BreadcrumbItem,
  Content,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  FormGroup,
  FormSelect,
  FormSelectOption,
  PageSection,
} from "@patternfly/react-core";
import LockIcon from "@patternfly/react-icons/dist/esm/icons/lock-icon";

import { MAX_ITEMS_PER_PAGE } from "@app/Constants";
import { DocumentMetadata } from "@app/components/DocumentMetadata";
import { PermissionsContext } from "@app/components/PermissionsContext";
import { ReadOnlyContext } from "@app/components/ReadOnlyContext";
import { UploadFiles } from "@app/components/UploadFiles";
import { useFetchSBOMGroups } from "@app/queries/sbom-groups";
import { useUploadSBOM } from "@app/queries/sboms";
import { Paths } from "@app/Routes";
import { getAxiosErrorMessage } from "@app/utils/utils";

export const SbomUpload: React.FC = () => {
  const { areMutationsDisabled } = React.useContext(ReadOnlyContext);
  const { isScoped, hasPermission, groupsWith } =
    React.useContext(PermissionsContext);

  // with scoped access, uploads must go into a group the user may upload into
  const [group, setGroup] = React.useState<string>("");
  const { result: visibleGroups } = useFetchSBOMGroups(
    null,
    { page: { pageNumber: 1, itemsPerPage: MAX_ITEMS_PER_PAGE } },
    {},
    isScoped,
  );
  const uploadGroups = React.useMemo(() => {
    const allowed = new Set(groupsWith("create.sbom"));
    return visibleGroups.data
      .filter((item) => allowed.has(item.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleGroups.data, groupsWith]);

  const { uploads, handleUpload, handleRemoveUpload } = useUploadSBOM(
    group || undefined,
  );

  const unavailable = areMutationsDisabled
    ? {
        title: "Uploads unavailable",
        body: "This instance is running in read-only mode. Uploading SBOMs is not available.",
      }
    : !hasPermission("create.sbom") ||
        (isScoped && groupsWith("create.sbom").length === 0)
      ? {
          title: "Uploads not permitted",
          body: "You don't have permission to upload SBOMs.",
        }
      : null;

  return (
    <>
      <DocumentMetadata title="Upload SBOM" />
      <PageSection type="breadcrumb">
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to={Paths.sboms}>SBOMs</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>Upload SBOM</BreadcrumbItem>
        </Breadcrumb>
      </PageSection>
      {unavailable ? (
        <PageSection>
          <EmptyState
            headingLevel="h1"
            icon={LockIcon}
            titleText={unavailable.title}
          >
            <EmptyStateBody>{unavailable.body}</EmptyStateBody>
            <EmptyStateFooter>
              <Link to={Paths.sboms}>Return to SBOMs</Link>
            </EmptyStateFooter>
          </EmptyState>
        </PageSection>
      ) : (
        <>
          <PageSection>
            <Content>
              <Content component="h1">Upload SBOM</Content>
              <Content component="p">
                Upload a Software Bill of Materials (SBOM) document. We accept
                CycloneDX versions 1.3, 1.4, 1.5 and 1.6, and System Package
                Data Exchange (SPDX) versions 2.2, and 2.3.
              </Content>
            </Content>
          </PageSection>
          {isScoped && (
            <PageSection>
              <FormGroup label="Group" isRequired fieldId="sbom-upload-group">
                <FormSelect
                  id="sbom-upload-group"
                  aria-label="Group to upload into"
                  value={group}
                  onChange={(_event, value) => setGroup(value)}
                >
                  <FormSelectOption
                    value=""
                    label="Select the group to upload into"
                    isPlaceholder
                  />
                  {uploadGroups.map((item) => (
                    <FormSelectOption
                      key={item.id}
                      value={item.id}
                      label={item.name}
                    />
                  ))}
                </FormSelect>
              </FormGroup>
            </PageSection>
          )}
          {(!isScoped || group) && (
            <PageSection>
              <UploadFiles
                fileUploadProps={{ "aria-label": "sbom-uploader" }}
                uploads={uploads}
                handleUpload={handleUpload}
                handleRemoveUpload={handleRemoveUpload}
                extractSuccessMessage={(
                  response: AxiosResponse<{ document_id: string }>,
                ) => {
                  return `${response.data.document_id} uploaded`;
                }}
                extractErrorMessage={getAxiosErrorMessage}
              />
            </PageSection>
          )}
        </>
      )}
    </>
  );
};
