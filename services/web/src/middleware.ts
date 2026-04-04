export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/download/:path*", "/docs/:path*"],
};
