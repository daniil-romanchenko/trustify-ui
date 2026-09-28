import React from "react";

import { useFetchSbomPermissions } from "@app/queries/sboms";

import { PermissionsContext } from "./PermissionsContext";

/**
 * Decide which actions to offer on individual SBOMs.
 *
 * When access is scoped, an SBOM's permissions depend on the groups it is assigned to, so they are
 * fetched for the given SBOMs. Until they are known, actions are not offered.
 */
export const useSbomPermissions = (ids: string[]) => {
  const { isScoped, hasPermission } = React.useContext(PermissionsContext);
  const { permissions, isLoading } = useFetchSbomPermissions(ids, isScoped);

  const hasSbomPermission = React.useCallback(
    (id: string, permission: string) =>
      hasPermission(permission) &&
      (!isScoped || (permissions?.[id]?.includes(permission) ?? false)),
    [isScoped, hasPermission, permissions],
  );

  return {
    hasSbomPermission,
    isLoading: isScoped && isLoading,
  };
};
