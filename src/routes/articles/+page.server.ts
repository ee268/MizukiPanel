import { fail, redirect } from '@sveltejs/kit';
import { readWorkspacePath } from '$lib/server/workspace';
import { inspectProject } from '$lib/server/project';
import { ArticleValidationError, type ArticleFields } from '$lib/server/article-format';
import { createArticle, deleteArticle, listArticles, readArticle, renameArticle,
  saveArticleFields, saveArticleSource } from '$lib/server/articles';
import { StorageConflict } from '$lib/server/storage';
import { PathGuardError } from '$lib/server/path-guard';
import type { Actions, PageServerLoad } from './$types';

async function project() {
  const connected = await readWorkspacePath();
  if (!connected) redirect(303, '/');
  return inspectProject(connected);
}
function value(form: FormData, name: string): string {
  const result = form.get(name);
  if (typeof result !== 'string') throw new ArticleValidationError('缺少字段：' + name);
  return result;
}
function optional(form: FormData, name: string): string {
  const result = form.get(name);
  return typeof result === 'string' ? result : '';
}
function formFields(form: FormData): ArticleFields {
  return {
    title: value(form, 'title'), published: value(form, 'published'),
    updated: optional(form, 'updated'), description: optional(form, 'description'),
    image: optional(form, 'image'), tags: optional(form, 'tags'),
    category: optional(form, 'category'), author: optional(form, 'author'),
    lang: optional(form, 'lang'), alias: optional(form, 'alias'),
    permalink: optional(form, 'permalink'), slug: optional(form, 'slug'), sourceLink: optional(form, 'sourceLink'),
    licenseName: optional(form, 'licenseName'), licenseUrl: optional(form, 'licenseUrl'),
    priority: optional(form, 'priority'), password: optional(form, 'password'),
    passwordHint: optional(form, 'passwordHint'),
    draft: form.has('draft'), pinned: form.has('pinned'), comment: form.has('comment'),
    encrypted: form.has('encrypted'), hideHomeContent: form.has('hideHomeContent')
  };
}
function failure(error: unknown) {
  if (error instanceof ArticleValidationError || error instanceof StorageConflict || error instanceof PathGuardError)
    return fail(400, { message: error.message });
  if ((error as NodeJS.ErrnoException)?.code === 'ENOENT')
    return fail(404, { message: '文章文件不存在或已被移动，请重新加载。' });
  throw error;
}

export const load: PageServerLoad = async ({ url }) => {
  const report = await project();
  const articles = await listArticles(report);
  const postId = url.searchParams.get('post');
  let selected = null;
  let selectionError = null;
  if (postId) {
    try { selected = await readArticle(report, postId); }
    catch (error) { selectionError = error instanceof Error ? error.message : '文章无法读取'; }
  }
  return { report, articles, selected, selectionError, creating: url.searchParams.has('new') };
};

export const actions: Actions = {
  create: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      const id = value(form, 'id');
      await createArticle(report, id, {
        title: value(form, 'title'), published: value(form, 'published'), draft: form.has('draft')
      }, optional(form, 'body'));
      redirect(303, '/articles?post=' + encodeURIComponent(id));
    } catch (error) { return failure(error); }
  },
  saveForm: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      const id = value(form, 'id');
      await saveArticleFields(report, id, formFields(form), value(form, 'version'));
      redirect(303, '/articles?post=' + encodeURIComponent(id));
    } catch (error) { return failure(error); }
  },
  saveSource: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      const id = value(form, 'id');
      await saveArticleSource(report, id, value(form, 'source'), value(form, 'version'));
      redirect(303, '/articles?post=' + encodeURIComponent(id));
    } catch (error) { return failure(error); }
  },
  rename: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      const id = value(form, 'id');
      const nextId = value(form, 'nextId');
      await renameArticle(report, id, nextId, value(form, 'version'));
      redirect(303, '/articles?post=' + encodeURIComponent(nextId));
    } catch (error) { return failure(error); }
  },
  delete: async ({ request }) => {
    try {
      const report = await project();
      const form = await request.formData();
      await deleteArticle(report, value(form, 'id'), value(form, 'version'));
      redirect(303, '/articles');
    } catch (error) { return failure(error); }
  }
};
