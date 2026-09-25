import React from "react";

import { useNavigate } from "react-router-dom";

import { Toolbar, ToolbarContent, ToolbarItem } from "@patternfly/react-core";

import { FilterToolbar } from "@app/components/FilterToolbar";
import { PermissionsContext } from "@app/components/PermissionsContext";
import { ReadOnlyButton } from "@app/components/ReadOnlyButton";
import { SimplePagination } from "@app/components/SimplePagination";
import { Paths } from "@app/Routes";

import { AdvisorySearchContext } from "./advisory-context";

interface AdvisoryToolbarProps {
  showFilters?: boolean;
  showActions?: boolean;
}

export const AdvisoryToolbar: React.FC<AdvisoryToolbarProps> = ({
  showFilters,
  showActions,
}) => {
  const navigate = useNavigate();

  const { tableControls } = React.useContext(AdvisorySearchContext);
  const { hasPermission } = React.useContext(PermissionsContext);

  const {
    propHelpers: {
      toolbarProps,
      filterToolbarProps,
      paginationToolbarItemProps,
      paginationProps,
    },
  } = tableControls;

  return (
    <Toolbar {...toolbarProps} aria-label="advisory-toolbar">
      <ToolbarContent>
        {showFilters && <FilterToolbar {...filterToolbarProps} />}
        {showActions && hasPermission("create.advisory") && (
          <ToolbarItem>
            <ReadOnlyButton
              variant="primary"
              onClick={() => navigate(Paths.advisoryUpload)}
            >
              Upload Advisory
            </ReadOnlyButton>
          </ToolbarItem>
        )}
        <ToolbarItem {...paginationToolbarItemProps}>
          <SimplePagination
            idPrefix="advisory-table"
            isTop
            paginationProps={paginationProps}
          />
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );
};
