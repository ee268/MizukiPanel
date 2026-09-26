<script lang="ts">
  import { enhance } from '$app/forms';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

  let { data, form } = $props();
  let query = $state('');
  let scope = $state<'public' | 'article'>('public');
  let visible = $derived(data.media.filter((item) => item.scope === scope && item.path.toLowerCase().includes(query.trim().toLowerCase())));
  const imageUrl = (item: { scope: string; path: string }) => `/media/file?scope=${item.scope}&path=${encodeURIComponent(item.path)}`;
  const size = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  async function copy(reference: string) { await navigator.clipboard.writeText(reference); }
</script>

<svelte:head><title>媒体管理 · MizukiPanel</title><meta name="robots" content="noindex" /></svelte:head>

<div class="bg-surface-50-950 min-h-screen">
  <header class="border-surface-200-800 bg-surface-100-900 border-b">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <div><p class="text-lg font-semibold">MizukiPanel <span class="text-sm font-normal opacity-60">/ 媒体管理</span></p><p class="text-xs opacity-60">公共图片与文章资源 · {data.media.length} 个文件</p></div>
      <nav class="flex gap-3"><a class="btn preset-tonal" href="/">工作区</a><a class="btn preset-tonal" href="/articles">文章</a><a class="btn preset-filled-primary-500" href="/preview">真实预览</a></nav>
    </div>
  </header>
  <main class="mx-auto max-w-7xl space-y-6 px-5 py-8">
    {#if form?.message}<div class="card border-primary-500/30 bg-primary-500/10 border p-4 text-sm" role="status">{form.message}</div>{/if}
    {#if data.report.readOnly}<div class="card border-warning-500/40 bg-warning-500/10 border p-4 text-sm">当前项目只读，媒体操作已禁用。</div>{/if}
    <section class="card bg-surface-100-900 space-y-4 p-6 shadow-sm">
      <div><h1 class="text-xl font-semibold">上传图片</h1><p class="mt-1 text-sm opacity-65">支持 PNG、JPEG、GIF、WebP、AVIF，最大 20 MB；同名文件不会被覆盖。</p></div>
      <form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance class="grid gap-4 md:grid-cols-2">
        <label class="label block space-y-1"><span>存储位置</span><select class="select w-full" name="scope" bind:value={scope}><option value="public">公共图片 /images/</option><option value="article">文章相对资源</option></select></label>
        {#if scope === 'article'}<label class="label block space-y-1"><span>所属文章</span><select class="select w-full" name="articleId" required>{#each data.articles as article}<option value={article.id}>{article.title} · {article.id}</option>{/each}</select></label>{/if}
        <label class="label block space-y-1"><span>子目录（可留空）</span><input class="input w-full font-mono" name="folder" placeholder={scope === 'public' ? 'posts/my-post' : 'assets'} spellcheck="false" /></label>
        <label class="label block space-y-1"><span>图片文件</span><input class="input w-full" type="file" name="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" required /></label>
        <div class="md:col-span-2"><button class="btn preset-filled-primary-500" type="submit" disabled={data.report.readOnly}>上传图片</button></div>
      </form>
    </section>
    <section class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex gap-2"><button class="btn" class:preset-filled-primary-500={scope === 'public'} class:preset-tonal={scope !== 'public'} onclick={() => scope='public'}>公共图片</button><button class="btn" class:preset-filled-primary-500={scope === 'article'} class:preset-tonal={scope !== 'article'} onclick={() => scope='article'}>文章资源</button></div>
        <label class="label w-full space-y-1 sm:w-72"><span class="text-sm">筛选路径</span><input class="input w-full" type="search" bind:value={query} placeholder="输入文件名" /></label>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each visible as item}
          <article class="card bg-surface-100-900 overflow-hidden shadow-sm">
            <img class="bg-surface-200-800 aspect-video w-full object-contain" src={imageUrl(item)} alt="" loading="lazy" />
            <div class="space-y-3 p-4"><p class="break-all font-mono text-xs">{item.path}</p><div class="flex justify-between text-xs opacity-60"><span>{size(item.size)}</span><span>{item.referencedBy.length} 处引用</span></div>
              <div class="flex flex-wrap gap-2"><button class="btn preset-tonal-primary-500 text-xs" type="button" onclick={() => copy(item.reference)}>复制引用</button>
                <Dialog><Dialog.Trigger class="btn preset-tonal-error-500 text-xs" disabled={data.report.readOnly || item.referencedBy.length > 0}>删除</Dialog.Trigger><Portal><Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60" /><Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4"><Dialog.Content class="card bg-surface-100-900 w-full max-w-md space-y-4 p-6"><Dialog.Title class="text-lg font-semibold">确认删除媒体</Dialog.Title><Dialog.Description class="break-all text-sm">文件会移入面板回收目录：{item.path}</Dialog.Description><div class="flex gap-3"><form method="POST" action="?/delete" use:enhance><input type="hidden" name="scope" value={item.scope} /><input type="hidden" name="path" value={item.path} /><button class="btn preset-filled-error-500" type="submit">确认删除</button></form><Dialog.CloseTrigger class="btn preset-tonal">取消</Dialog.CloseTrigger></div></Dialog.Content></Dialog.Positioner></Portal></Dialog>
              </div>{#if item.referencedBy.length}<p class="text-xs text-warning-600-400">仍被引用，移除文章引用后才能删除。</p>{/if}</div>
          </article>
        {:else}<div class="card bg-surface-100-900 p-8 text-sm opacity-60 sm:col-span-2">当前范围没有匹配的媒体。</div>{/each}
      </div>
    </section>
  </main>
</div>
