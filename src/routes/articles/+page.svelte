<script lang="ts">
  import { enhance } from '$app/forms';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

  let { data, form } = $props();
  let query = $state('');
  let filter = $state<'all' | 'published' | 'draft' | 'invalid'>('all');
  let editorMode = $state<'form' | 'source'>('form');
  const today = new Date().toISOString().slice(0, 10);
  let visible = $derived(data.articles.filter((article) => {
    const matchesText = (article.title + ' ' + article.id).toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'draft' && article.draft)
      || (filter === 'published' && !article.draft && !article.error)
      || (filter === 'invalid' && Boolean(article.error));
    return matchesText && matchesFilter;
  }));
</script>

<svelte:head>
  <title>文章管理 · MizukiPanel</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="bg-surface-50-950 min-h-screen">
  <header class="border-surface-200-800 bg-surface-100-900 border-b">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <div>
        <p class="text-lg font-semibold">MizukiPanel <span class="text-sm font-normal opacity-60">/ 文章管理</span></p>
        <p class="text-xs opacity-60">{data.report.mode === 'external' ? '独立内容仓库' : '本地内容'} · {data.articles.length} 篇文章</p>
      </div>
      <nav class="flex items-center gap-3 text-sm">
        <a class="btn preset-tonal" href="/">工作区</a>
        <a class="btn preset-filled-primary-500" href="/articles?new=1">新建文章</a>
      </nav>
    </div>
  </header>

  <main class="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
    <aside class="card bg-surface-100-900 h-fit space-y-4 p-4 shadow-sm">
      <div class="space-y-3">
        <label class="label block space-y-1">
          <span class="text-sm font-medium">搜索标题或文件名</span>
          <input class="input w-full" type="search" placeholder="搜索文章" bind:value={query} />
        </label>
        <label class="label block space-y-1">
          <span class="text-sm font-medium">状态</span>
          <select class="select w-full" bind:value={filter}>
            <option value="all">全部</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="invalid">需要修复</option>
          </select>
        </label>
      </div>
      <div class="max-h-[65vh] space-y-1 overflow-auto">
        {#each visible as article}
          <a href={'/articles?post=' + encodeURIComponent(article.id)}
            class:preset-tonal-primary-500={data.selected?.id === article.id}
            class="block rounded-lg px-3 py-3 transition-colors hover:bg-primary-500/10">
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-medium leading-snug">{article.title}</span>
              {#if article.error}<span class="badge preset-tonal-error-500 text-xs">异常</span>
              {:else if article.draft}<span class="badge preset-tonal-warning-500 text-xs">草稿</span>{/if}
            </div>
            <p class="mt-1 break-all font-mono text-xs opacity-55">{article.id}</p>
            {#if article.published}<p class="mt-1 text-xs opacity-55">{article.published}</p>{/if}
          </a>
        {:else}
          <p class="px-3 py-5 text-sm opacity-60">没有匹配的文章。</p>
        {/each}
      </div>
    </aside>

    <div class="space-y-5">
      {#if form?.message}<div class="card border-error-500/40 bg-error-500/10 border p-4 text-sm" role="alert">{form.message}</div>{/if}
      {#if data.report.readOnly}
        <div class="card border-warning-500/40 bg-warning-500/10 border p-4 text-sm" role="status">
          当前项目只读。请返回工作区处理配置后再编辑。
        </div>
      {/if}
      {#if data.selectionError}
        <div class="card border-error-500/40 bg-error-500/10 border p-4 text-sm" role="alert">{data.selectionError}</div>
      {/if}

      {#if data.creating}
        <section class="card bg-surface-100-900 space-y-5 p-6 shadow-sm">
          <div>
            <h1 class="text-2xl font-semibold">新建文章</h1>
            <p class="mt-1 text-sm opacity-65">文件路径相对于 posts 目录，支持子目录和 .mdx。</p>
          </div>
          <form method="POST" action="?/create" use:enhance class="space-y-4">
            <label class="label block space-y-1">
              <span>文章文件路径</span>
              <input class="input w-full font-mono" name="id" placeholder="notes/my-post.md" required spellcheck="false" />
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="label block space-y-1">
                <span>标题</span>
                <input class="input w-full" name="title" required />
              </label>
              <label class="label block space-y-1">
                <span>发布日期</span>
                <input class="input w-full" name="published" value={today} placeholder="YYYY-MM-DD" required />
              </label>
            </div>
            <label class="label inline-flex items-center gap-2">
              <input class="checkbox" type="checkbox" name="draft" checked />
              <span>先保存为草稿</span>
            </label>
            <label class="label block space-y-1">
              <span>正文（Markdown 或 MDX）</span>
              <textarea class="textarea min-h-64 w-full font-mono text-sm" name="body" placeholder="# 开始写作"></textarea>
            </label>
            <button class="btn preset-filled-primary-500" type="submit" disabled={data.report.readOnly}>创建文章</button>
          </form>
        </section>
      {:else if data.selected}
        {@const article = data.selected}
        <section class="card bg-surface-100-900 space-y-5 p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-2xl font-semibold">{article.title}</h1>
              <p class="mt-1 break-all font-mono text-xs opacity-60">{article.id} · {article.format.toUpperCase()}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn preset-tonal" class:preset-filled-primary-500={editorMode === 'form'} type="button" onclick={() => editorMode = 'form'} disabled={Boolean(article.error)}>表单</button>
              <button class="btn preset-tonal" class:preset-filled-primary-500={editorMode === 'source'} type="button" onclick={() => editorMode = 'source'}>源码</button>
            </div>
          </div>
          {#if article.error}<p class="rounded-lg bg-error-500/10 p-3 text-sm" role="alert">Frontmatter 需要修复：{article.error}。请使用源码模式编辑。</p>{/if}

          {#if editorMode === 'source' || article.error}
            <form method="POST" action="?/saveSource" use:enhance class="space-y-4">
              <input type="hidden" name="id" value={article.id} />
              <input type="hidden" name="version" value={article.version} />
              <label class="label block space-y-2">
                <span class="font-medium">完整文章源码</span>
                <textarea class="textarea min-h-[36rem] w-full font-mono text-sm leading-relaxed" name="source" value={article.source} spellcheck="false" required></textarea>
              </label>
              <p class="text-xs opacity-65">保存时会检查 YAML、日期、URL 与文章路由。未改动的源码会按原样写入。</p>
              <button class="btn preset-filled-primary-500" type="submit" disabled={data.report.readOnly}>保存源码</button>
            </form>
          {:else}
            <form method="POST" action="?/saveForm" use:enhance class="space-y-5">
              <input type="hidden" name="id" value={article.id} />
              <input type="hidden" name="version" value={article.version} />
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="label block space-y-1 sm:col-span-2"><span>标题</span><input class="input w-full" name="title" value={article.fields.title} required /></label>
                <label class="label block space-y-1"><span>发布日期</span><input class="input w-full" name="published" value={article.fields.published} placeholder="YYYY-MM-DD 或 ISO 时间" required /></label>
                <label class="label block space-y-1"><span>更新日期</span><input class="input w-full" name="updated" value={article.fields.updated} placeholder="可留空" /></label>
                <label class="label block space-y-1 sm:col-span-2"><span>描述</span><textarea class="textarea w-full" name="description" value={article.fields.description}></textarea></label>
                <label class="label block space-y-1"><span>标签（逗号分隔）</span><input class="input w-full" name="tags" value={article.fields.tags} /></label>
                <label class="label block space-y-1"><span>分类</span><input class="input w-full" name="category" value={article.fields.category} /></label>
                <label class="label block space-y-1"><span>封面图片地址</span><input class="input w-full" name="image" value={article.fields.image} /></label>
                <label class="label block space-y-1"><span>作者</span><input class="input w-full" name="author" value={article.fields.author} /></label>
                <label class="label block space-y-1"><span>别名 alias</span><input class="input w-full" name="alias" value={article.fields.alias} placeholder="posts 下的路径" spellcheck="false" /></label>
                <label class="label block space-y-1"><span>固定链接 permalink</span><input class="input w-full" name="permalink" value={article.fields.permalink} placeholder="站点根目录下的路径" spellcheck="false" /></label>
              </div>
              <div class="flex flex-wrap gap-5 text-sm">
                <label class="label inline-flex items-center gap-2"><input class="checkbox" type="checkbox" name="draft" checked={article.fields.draft} />草稿</label>
                <label class="label inline-flex items-center gap-2"><input class="checkbox" type="checkbox" name="pinned" checked={article.fields.pinned} />置顶</label>
                <label class="label inline-flex items-center gap-2"><input class="checkbox" type="checkbox" name="comment" checked={article.fields.comment} />允许评论</label>
              </div>
              <details class="rounded-xl border border-surface-300-700 p-4">
                <summary class="cursor-pointer font-medium">更多 Frontmatter 字段</summary>
                <div class="mt-4 grid gap-4 sm:grid-cols-2">
                  <label class="label block space-y-1"><span>Astro slug（覆盖文件名）</span><input class="input w-full" name="slug" value={article.fields.slug} spellcheck="false" /></label>
                  <label class="label block space-y-1"><span>语言</span><input class="input w-full" name="lang" value={article.fields.lang} /></label>
                  <label class="label block space-y-1"><span>排序优先级</span><input class="input w-full" name="priority" value={article.fields.priority} inputmode="decimal" /></label>
                  <label class="label block space-y-1"><span>来源链接</span><input class="input w-full" name="sourceLink" value={article.fields.sourceLink} /></label>
                  <label class="label block space-y-1"><span>许可名称</span><input class="input w-full" name="licenseName" value={article.fields.licenseName} /></label>
                  <label class="label block space-y-1"><span>许可链接</span><input class="input w-full" name="licenseUrl" value={article.fields.licenseUrl} /></label>
                  <label class="label block space-y-1"><span>加密密码</span><input class="input w-full" name="password" value={article.fields.password} /></label>
                  <label class="label block space-y-1"><span>密码提示</span><input class="input w-full" name="passwordHint" value={article.fields.passwordHint} /></label>
                  <div class="flex flex-wrap items-center gap-4">
                    <label class="label inline-flex items-center gap-2"><input class="checkbox" type="checkbox" name="encrypted" checked={article.fields.encrypted} />加密</label>
                    <label class="label inline-flex items-center gap-2"><input class="checkbox" type="checkbox" name="hideHomeContent" checked={article.fields.hideHomeContent} />隐藏首页正文</label>
                  </div>
                </div>
              </details>
              <button class="btn preset-filled-primary-500" type="submit" disabled={data.report.readOnly}>保存 Frontmatter</button>
            </form>
          {/if}
        </section>

        <section class="card bg-surface-100-900 space-y-4 p-6 shadow-sm">
          <h2 class="text-lg font-semibold">文件操作</h2>
          <form method="POST" action="?/rename" use:enhance class="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={article.id} />
            <input type="hidden" name="version" value={article.version} />
            <label class="label min-w-64 flex-1 space-y-1"><span>重命名为（相对于 posts）</span><input class="input w-full font-mono" name="nextId" value={article.id} required /></label>
            <button class="btn preset-tonal-primary-500" type="submit" disabled={data.report.readOnly}>重命名</button>
          </form>
          <Dialog>
            <Dialog.Trigger class="btn preset-tonal-error-500" disabled={data.report.readOnly}>删除文章</Dialog.Trigger>
            <Portal>
              <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60" />
              <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <Dialog.Content class="card bg-surface-100-900 w-full max-w-md space-y-4 p-6 shadow-xl">
                  <Dialog.Title class="text-lg font-semibold">确认删除文章</Dialog.Title>
                  <Dialog.Description class="text-sm">文件将移入面板的本地回收目录，可从备份恢复。{article.id}</Dialog.Description>
                  <div class="flex gap-3">
                    <form method="POST" action="?/delete" use:enhance>
                      <input type="hidden" name="id" value={article.id} />
                      <input type="hidden" name="version" value={article.version} />
                      <button class="btn preset-filled-error-500" type="submit">确认删除</button>
                    </form>
                    <Dialog.CloseTrigger class="btn preset-tonal">取消</Dialog.CloseTrigger>
                  </div>
                </Dialog.Content>
              </Dialog.Positioner>
            </Portal>
          </Dialog>
        </section>
      {:else}
        <section class="card bg-surface-100-900 p-10 text-center shadow-sm">
          <h1 class="text-2xl font-semibold">选择一篇文章</h1>
          <p class="mt-2 text-sm opacity-65">可编辑 Frontmatter 或完整 Markdown/MDX 源码。</p>
        </section>
      {/if}
    </div>
  </main>
</div>
