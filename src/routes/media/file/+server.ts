import { error } from '@sveltejs/kit';
import { inspectProject } from '$lib/server/project';
import { readWorkspacePath } from '$lib/server/workspace';
import { MediaError, readMedia, type MediaScope } from '$lib/server/media';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const root = await readWorkspacePath();
  if (!root) error(400, '未连接工作区');
  const scope = url.searchParams.get('scope');
  const mediaPath = url.searchParams.get('path');
  if ((scope !== 'public' && scope !== 'article') || !mediaPath) error(400, '媒体参数无效');
  try {
    const media = await readMedia(await inspectProject(root), scope as MediaScope, mediaPath);
    return new Response(Uint8Array.from(media.bytes), {
      headers: { 'content-type': media.type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
    });
  } catch (cause) {
    if (cause instanceof MediaError || (cause as NodeJS.ErrnoException)?.code === 'ENOENT') error(404, '媒体不存在');
    throw cause;
  }
};
