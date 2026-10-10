import { AsyncLocalStorage } from "node:async_hooks";
const state = new AsyncLocalStorage<string>();
export const withWorkspaceState = <T>(directory: string, action: () => T): T =>
  state.run(directory, action);
export const workspaceStateDirectory = () => state.getStore();
