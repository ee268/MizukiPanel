<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  let preview = $state(data.preview);
  // svelte-ignore state_referenced_locally
  let pagePath = $state(data.requestedPath);

  onMount(() => {
    const timer = setInterval(async () => {
      const response = await fetch('/preview/status');
      if (response.ok) preview = await response.json();
    }, 1500);
    return () => clearInterval(timer);
  });

  const label = { stopped: '未启动', starting: '启动中', running: '运行中', external: '已连接外部服务', failed: '启动失败' };
  let iframeUrl = $derived(preview.url.replace(/\/$/, '') + (pagePath.startsWith('/') ? pagePath : '/' + pagePath));
</script>

<svelte:head><title>真实预览 · MizukiPanel</title><meta name="robots" content="noindex" /></svelte:head>

<div class="bg-surface-50-950 min-h-screen">
  <header class="border-surface-200-800 bg-surface-100-900 border-b">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <div><p class="text-lg font-semibold">MizukiPanel <span class="text-sm font-normal opacity-60">/ 真实预览</span></p><p class="text-xs opacity-60">Astro 开发服务器 · {label[preview.state]}</p></div>
      <nav class="flex gap-3"><a class="btn preset-tonal" href="/">工作区</a><a class="btn preset-tonal" href="/articles">文章</a><a class="btn preset-tonal" href="/media">媒体</a></nav>
    </div>
  </header>
  <main class="mx-auto max-w-7xl space-y-5 px-5 py-8">
    {#if form?.message}<div class="card bg-primary-500/10 p-4 text-sm">{form.message}</div>{/if}
    {#if preview.error}<div class="card border-warning-500/40 bg-warning-500/10 border p-4 text-sm">{preview.error}</div>{/if}
    <section class="card bg-surface-100-900 flex flex-wrap items-end gap-3 p-5 shadow-sm">
      <form method="POST" action="?/start" use:enhance><button class="btn preset-filled-primary-500" type="submit" disabled={preview.state === 'running' || preview.state === 'starting' || preview.state === 'external'}>启动 Astro 预览</button></form>
      <form method="POST" action="?/stop" use:enhance><button class="btn preset-tonal-error-500" type="submit" disabled={preview.state !== 'running' && preview.state !== 'starting'}>停止</button></form>
      <label class="label min-w-60 flex-1 space-y-1"><span class="text-sm">预览路径</span><input class="input w-full font-mono" bind:value={pagePath} placeholder="/posts/example/" /></label>
      <a class="btn preset-tonal" href={iframeUrl} target="_blank" rel="noreferrer">新窗口打开</a>
    </section>
    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="card bg-surface-100-900 min-h-[65vh] overflow-hidden shadow-sm">
        {#if preview.state === 'running' || preview.state === 'external'}
          <iframe class="h-[72vh] w-full bg-white" title="Mizuki Astro 真实预览" src={iframeUrl}></iframe>
        {:else}<div class="flex h-[65vh] items-center justify-center text-sm opacity-60">启动后在此显示真实 Astro 页面。</div>{/if}
      </div>
      <aside class="card bg-surface-950 text-surface-50 h-[72vh] overflow-auto p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between"><h2 class="font-semibold">运行日志</h2><span class="text-xs opacity-60">最近 {preview.logs.length} 行</span></div>
        <pre class="whitespace-pre-wrap break-words text-xs leading-relaxed">{preview.logs.join('\n') || '暂无日志'}</pre>
      </aside>
    </section>
  </main>
</div>
