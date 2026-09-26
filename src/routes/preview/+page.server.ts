import { fail } from '@sveltejs/kit';
import { inspectProject } from '$lib/server/project';
import { readWorkspacePath } from '$lib/server/workspace';
import { previewStatus, startPreview, stopPreview } from '$lib/server/preview';
import type { Actions, PageServerLoad } from './$types';

async function project() {
  const root = await readWorkspacePath();
  if (!root) throw new Error('请先连接 Mizuki 工作区');
  return inspectProject(root);
}

export const load: PageServerLoad = async ({ url }) => {
  const report = await project();
  const requestedPath = url.searchParams.get('path');
  return { report, preview: await previewStatus(report),
    requestedPath: requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/' };
};

export const actions: Actions = {
  start: async () => {
    try { await startPreview(await project()); return { message: '预览启动请求已发送' }; }
    catch (error) { return fail(400, { message: error instanceof Error ? error.message : '预览启动失败' }); }
  },
  stop: async () => {
    try { await stopPreview(await project()); return { message: '预览已停止' }; }
    catch (error) { return fail(400, { message: error instanceof Error ? error.message : '预览停止失败' }); }
  }
};
