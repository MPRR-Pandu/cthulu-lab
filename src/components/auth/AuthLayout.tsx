import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono p-4">
      <div className="w-full max-w-md border border-[#333333] bg-black">
        <div className="border-b border-[#333333] px-4 py-2 flex items-center gap-2 text-xs">
          <span className="text-[#ff6b6b]">●</span>
          <span className="text-[#f5c542]">●</span>
          <span className="text-[#5dadec]">●</span>
          <span className="text-[#808080] ml-2">cthulu-lab://auth</span>
        </div>
        <div className="p-6">{children}</div>
        <div className="border-t border-[#333333] px-4 py-2 text-xs text-[#555]">
          <span>$ system v0.1.0</span>
          <span className="ml-2 animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}
