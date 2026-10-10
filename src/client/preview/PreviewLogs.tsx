import { TaskLogs } from "../components/TaskLogs";
export function PreviewLogs({ logs, limit }: { logs: string[]; limit?: number }) {
  return <TaskLogs logs={logs} limit={limit} />;
}
