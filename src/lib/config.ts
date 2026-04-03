// Centralized config — all external URLs flow from here.
// Persisted to localStorage so settings survive app restart.

const STORAGE_KEY = "cthulu-lab-config";

interface Config {
  apiUrl: string;       // Express backend (MongoDB, workflows, auth)
  gatewayUrl: string;   // VM Manager (create/delete/exec VMs)
}

const DEFAULTS: Config = {
  apiUrl: "http://localhost:3000/api",
  gatewayUrl: "",
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
