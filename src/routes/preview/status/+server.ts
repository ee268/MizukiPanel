import { json } from '@sveltejs/kit';
import { inspectProject } from '$lib/server/project';
import { previewStatus } from '$lib/server/preview';
import { readWorkspacePath } from '$lib/server/workspace';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const root = await readWorkspacePath();
  if (!root) return json({ error: '未连接工作区' }, { status: 400 });
  const report = await inspectProject(root);
  return json(await previewStatus(report));
};
