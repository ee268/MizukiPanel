import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, validAccessToken } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.authenticated) redirect(303, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const token = form.get('token');
    if (typeof token !== 'string' || !validAccessToken(token.trim())) {
      return fail(400, { message: '访问令牌无效，请使用本次启动时终端显示的令牌。' });
    }
    cookies.set(SESSION_COOKIE, token.trim(), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: false
    });
    redirect(303, '/');
  }
};
