import { fail } from '@sveltejs/kit';
import { inspectProject } from '$lib/server/project';
import { readWorkspacePath } from '$lib/server/workspace';
import { listArticles } from '$lib/server/articles';
import { deleteMedia, listMedia, MediaError, uploadMedia, type MediaScope } from '$lib/server/media';
import { PathGuardError } from '$lib/server/path-guard';
import type { Actions, PageServerLoad } from './$types';

async function project() {
  const root = await readWorkspacePath();
  if (!root) throw new MediaError('请先连接 Mizuki 工作区');
  return inspectProject(root);
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  if (typeof value !== 'string') throw new MediaError('缺少字段：' + key);
  return value;
}

function scope(form: FormData): MediaScope {
  const value = text(form, 'scope');
  if (value !== 'public' && value !== 'article') throw new MediaError('媒体范围无效');
  return value;
}

function failure(error: unknown) {
  if (error instanceof MediaError || error instanceof PathGuardError)
    return fail(400, { message: error.message });
  if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return fail(404, { message: '媒体文件不存在' });
  throw error;
}

export const load: PageServerLoad = async () => {
  const report = await project();
  const [media, articles] = await Promise.all([listMedia(report), listArticles(report)]);
  return { report, media, articles: articles.filter((article) => !article.error).map(({ id, title }) => ({ id, title })) };
};

export const actions: Actions = {
  upload: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || !file.name) throw new MediaError('请选择图片文件');
      const folder = text(form, 'folder').trim().replace(/^\/+|\/+$/g, '');
      const mediaPath = folder ? `${folder}/${file.name}` : file.name;
      const selectedScope = scope(form);
      const reference = await uploadMedia(report, selectedScope, mediaPath, Buffer.from(await file.arrayBuffer()),
        selectedScope === 'article' ? text(form, 'articleId') : undefined);
      return { message: `上传成功，可引用：${reference}`, reference };
    } catch (error) { return failure(error); }
  },
  delete: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      const trash = await deleteMedia(report, scope(form), text(form, 'path'));
      return { message: `媒体已移入回收目录：${trash}` };
    } catch (error) { return failure(error); }
  }
};
