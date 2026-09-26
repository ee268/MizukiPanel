import { fail, redirect } from '@sveltejs/kit';
import { inspectProject, ProjectError } from '$lib/server/project';
import { clearWorkspace, readWorkspacePath, saveWorkspacePath } from '$lib/server/workspace';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  let connectedPath: string | null;
  try {
    connectedPath = await readWorkspacePath();
  } catch {
    return { report: null, connectionError: '本机工作区记录无法读取，请检查 .local/workspace.json。', connectedPath: null };
  }
  if (!connectedPath) return { report: null, connectionError: null, connectedPath: null };
  try {
    const report = await inspectProject(connectedPath);
    return { report, connectionError: null, connectedPath };
  } catch (error) {
    return {
      report: null,
      connectionError: error instanceof Error ? error.message : '项目检查失败',
      connectedPath
    };
  }
};

export const actions: Actions = {
  connect: async ({ request }) => {
    const form = await request.formData();
    const requestedPath = form.get('projectPath');
    if (typeof requestedPath !== 'string') {
      return fail(400, { message: '请输入 Mizuki 项目目录。' });
    }
    try {
      const report = await inspectProject(requestedPath);
      await saveWorkspacePath(report.root);
    } catch (error) {
      if (error instanceof ProjectError) return fail(400, { message: error.message });
      throw error;
    }
    redirect(303, '/');
  },
  disconnect: async () => {
    await clearWorkspace();
    redirect(303, '/');
  }
};
