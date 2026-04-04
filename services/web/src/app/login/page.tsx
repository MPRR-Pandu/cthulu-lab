import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/download");

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <Link href="/docs" className="text-cyan font-bold tracking-widest text-xl">
          CTHULU LAB
        </Link>

        <div className="w-full border border-[#1a1a1a] bg-[#0a0a0a] p-8 flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-green font-bold text-sm tracking-wider mb-2">
              AUTHENTICATE
            </h1>
            <p className="text-dim text-xs">
              sign in to download Cthulu Lab for Mac
            </p>
          </div>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/download" });
            }}
          >
            <button
              type="submit"
              className="w-full px-6 py-3 bg-cyan text-black font-bold text-sm tracking-wider hover:bg-cyan/80 transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              SIGN IN WITH GOOGLE
            </button>
          </form>

          <div className="text-center text-dim text-[10px]">
            <span className="text-green">$</span> secure oauth2 flow
          </div>
        </div>

        <div className="flex items-center gap-2 text-dim text-[10px]">
          <span>powered by</span>
          <a href="https://bitcoin.com" target="_blank" rel="noopener noreferrer" className="text-[#f7931a] hover:text-[#f7931a]/80 font-bold tracking-wider">
            BITCOIN.COM
          </a>
        </div>
      </div>
    </div>
  );
}
