export interface AgentConfig {
  id: string;
  name: string;
  display_name: string;
  description: string;
  color: string;
  disallowed_tools: string[];
  personality: string;
  voice_style: string;
  species: string;
  catchphrase: string;
}
