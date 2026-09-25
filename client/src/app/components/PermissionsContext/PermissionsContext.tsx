import React from "react";

import type { GroupPermissions } from "@app/client";

export interface IPermissionsContext {
  isLoading: boolean;
  /** Whether access to SBOMs is limited to groups the user holds a role on. */
  isScoped: boolean;
  /** Whether the user may perform actions requiring the permission. */
  hasPermission: (permission: string) => boolean;
  /** The IDs of the groups the permission is granted in, when scoped. */
  groupsWith: (permission: string) => string[];
}

/**
 * Defaults to permitting everything, the server enforces authorization. Permissions are only
 * used to hide actions which would fail.
 */
export const PermissionsContext = React.createContext<IPermissionsContext>({
  isLoading: true,
  isScoped: false,
  hasPermission: () => true,
  groupsWith: () => [],
});

export const groupsWithPermission = (
  groups: GroupPermissions[],
  permission: string,
): string[] =>
  groups
    .filter((group) => group.permissions.includes(permission))
    .map((group) => group.id);
