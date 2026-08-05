import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: false,
    // FIX-1: staleTime MUST be 0. With any positive value, router.invalidate()
    // is silently ignored (data is considered "fresh"), causing the SSR placeholder
    // to never clear and the skeleton to loop forever.
    defaultStaleTime: 0,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
