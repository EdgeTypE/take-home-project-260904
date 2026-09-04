import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createContext } from "@/server/trpc/trpc";

const handler = async (req: Request) => {
  const responseHeaders = new Headers();
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext({
        headers: req.headers,
        setCookie: (cookie) => responseHeaders.append("Set-Cookie", cookie),
      }),
  });

  if (responseHeaders.has("set-cookie")) {
    const merged = new Headers(response.headers);
    for (const cookie of responseHeaders.getSetCookie()) {
      merged.append("Set-Cookie", cookie);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: merged,
    });
  }
  return response;
};

export { handler as GET, handler as POST };
