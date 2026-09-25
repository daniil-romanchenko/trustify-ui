import { useQuery } from "@tanstack/react-query";

import { client } from "@app/axios-config/apiInit";
import { getMe } from "@app/client";

export const MeQueryKey = "me";

/** Fetches the calling user, its permissions, and its access to SBOM groups. */
export const useFetchMe = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: [MeQueryKey],
    queryFn: () => getMe({ client, throwOnError: true }),
  });

  return {
    me: data?.data,
    isLoading,
    error,
  };
};
