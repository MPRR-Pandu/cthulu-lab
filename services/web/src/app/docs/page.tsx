"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function DocsPage() {
  return (
    <div className="flex flex-col flex-1">
      <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]">
        <a href="/" className="text-cyan font-bold tracking-wider text-sm">
          CTHULU LAB
        </a>
        <a
          href="/download"
          className="px-3 py-1 text-xs border border-[#333] text-[#e0e0e0] hover:border-cyan hover:text-cyan transition-colors"
        >
          DOWNLOAD
        </a>
      </nav>

      <div className="flex-1 bg-[#0a0a0a]">
        <style>{`
          .swagger-ui { background: #0a0a0a !important; }
          .swagger-ui .topbar { display: none !important; }
          .swagger-ui .info .title { color: #4de8e0 !important; font-family: monospace !important; }
          .swagger-ui .info p, .swagger-ui .info li { color: #808080 !important; }
          .swagger-ui .scheme-container { background: #111 !important; border-color: #333 !important; }
          .swagger-ui .opblock-tag { color: #e0e0e0 !important; border-color: #333 !important; }
          .swagger-ui .opblock { border-color: #333 !important; background: #111 !important; }
          .swagger-ui .opblock .opblock-summary { border-color: #333 !important; }
          .swagger-ui .opblock .opblock-summary-method { font-family: monospace !important; }
          .swagger-ui .opblock .opblock-summary-path { color: #e0e0e0 !important; font-family: monospace !important; }
          .swagger-ui .opblock .opblock-summary-description { color: #808080 !important; }
          .swagger-ui .opblock-body { background: #0a0a0a !important; }
          .swagger-ui .model-box { background: #111 !important; }
          .swagger-ui .model { color: #e0e0e0 !important; }
          .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #808080 !important; border-color: #333 !important; }
          .swagger-ui .response-col_status { color: #4de8e0 !important; }
          .swagger-ui .btn { border-color: #333 !important; color: #e0e0e0 !important; background: #111 !important; }
          .swagger-ui select { background: #111 !important; color: #e0e0e0 !important; border-color: #333 !important; }
          .swagger-ui input { background: #111 !important; color: #e0e0e0 !important; border-color: #333 !important; }
          .swagger-ui textarea { background: #111 !important; color: #e0e0e0 !important; border-color: #333 !important; }
          .swagger-ui .opblock-tag-section { border-color: #1a1a1a !important; }
          .swagger-ui .opblock-get .opblock-summary { border-color: #4de8e0 !important; }
          .swagger-ui .opblock-post .opblock-summary { border-color: #5ddb6e !important; }
          .swagger-ui .opblock-put .opblock-summary { border-color: #e8d44d !important; }
          .swagger-ui .opblock-delete .opblock-summary { border-color: #f06060 !important; }
        `}</style>
        <SwaggerUI url="/openapi.json" />
      </div>
    </div>
  );
}
