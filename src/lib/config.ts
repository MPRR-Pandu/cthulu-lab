// Centralized config — all external URLs flow from here.
// Persisted to localStorage so settings survive app restart.
//
// Defaults assume a local dev setup (Express on :3001, VM gateway on :8080).
// Override at build time via Vite env vars (VITE_API_URL / VITE_GATEWAY_URL)
// or at runtime in the in-app Connection settings panel.

const STORAGE_KEY = "cthulu-lab-config";

interface Config {
  apiUrl: string;       // Express backend (MongoDB, workflows, auth)
  gatewayUrl: string;   // VM Manager (create/delete/exec VMs)
}

const DEFAULTS: Config = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001/api",
  gatewayUrl: import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8080",
};

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      _config = saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
    } catch {
      _config = { ...DEFAULTS };
    }
  }
  return _config!;
}

export function setConfig(updates: Partial<Config>): void {
  const current = getConfig();
  _config = { ...current, ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_config));
}

export function getApiUrl(): string {
  return getConfig().apiUrl;
}

export function getGatewayUrl(): string {
  return getConfig().gatewayUrl;
}
