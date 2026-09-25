import React from "react";

import { useFetchMe } from "@app/queries/me";

import { groupsWithPermission, PermissionsContext } from "./PermissionsContext";

interface IPermissionsProvider {
  children: React.ReactNode;
}

/** Provides the permissions of the calling user to the component tree. */
export const PermissionsProvider: React.FunctionComponent<
  IPermissionsProvider
> = ({ children }) => {
  const { me, isLoading } = useFetchMe();

  const value = React.useMemo(() => {
    // unknown (e.g. authentication disabled, or an older server): permit everything
    const effective = me?.effectivePermissions ?? null;
    const groups = me?.groups ?? [];

    return {
      isLoading,
      isScoped: me?.scoped ?? false,
      hasPermission: (permission: string) =>
        effective === null || effective.includes(permission),
      groupsWith: (permission: string) =>
        groupsWithPermission(groups, permission),
    };
  }, [me, isLoading]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};
