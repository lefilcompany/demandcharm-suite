/** Canonical SoMA+ URL builder. */
const APP_URL =
  (typeof process !== "undefined" && process.env?.PUBLIC_APP_URL) ||
  "https://pla.soma.lefil.com.br";

const base = () => APP_URL.replace(/\/$/, "");

export const urls = {
  team: (id: string) => `${base()}/teams/${id}`,
  board: (id: string) => `${base()}/app/boards/${id}`,
  boardKanban: (id: string) => `${base()}/app/boards/${id}/kanban`,
  demand: (id: string) => `${base()}/app/demands/${id}`,
  request: (id: string) => `${base()}/requests/${id}`,
  note: (id: string) => `${base()}/app/notes/${id}`,
  project: (id: string) => `${base()}/app/projects/${id}`,
  profile: (id: string) => `${base()}/user/${id}`,
  service: (id: string) => `${base()}/services/${id}`,
  reports: () => `${base()}/reports`,
  time: () => `${base()}/time`,
  mcpDocs: () => `${base()}/mcp-docs`,
};
