<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

  let { data, form } = $props();

  const modeLabel = {
    local: '本地内容',
    external: '独立内容仓库',
    blocked: '配置待确认'
  };
</script>

<svelte:head>
  <title>工作区 · MizukiPanel</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="bg-surface-50-950 min-h-screen">
  <header class="border-surface-200-800 bg-surface-100-900 border-b">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <div class="flex items-center gap-3">
        <span class="bg-primary-500/15 text-primary-700-300 flex size-10 items-center justify-center rounded-xl text-lg font-bold">M</span>
        <div>
          <p class="text-lg font-semibold leading-tight">MizukiPanel</p>
          <p class="text-xs opacity-60">本机博客管理工作区</p>
        </div>
      </div>
      <span class="badge preset-tonal text-xs">阶段 1 · 项目连接</span>
    </div>
  </header>

  <main class="mx-auto max-w-6xl space-y-8 px-5 py-10">
    <section class="space-y-2">
      <h1 class="text-3xl font-semibold">连接 Mizuki 项目</h1>
      <p class="max-w-3xl opacity-70">选择本机 Mizuki 根目录。面板会读取配置并显示实际内容来源；当前阶段不会改动博客文件。</p>
    </section>

    <section class="card bg-surface-100-900 space-y-5 p-6 shadow-sm">
      <form method="POST" action="?/connect" class="space-y-4">
        <label class="label block space-y-2">
          <span class="font-medium">Mizuki 项目绝对路径</span>
          <input class="input w-full" type="text" name="projectPath" value={data.connectedPath ?? ''} placeholder="C:\sites\Mizuki" required spellcheck="false" />
        </label>
        {#if form?.message}
          <p class="text-error-500 text-sm" role="alert">{form.message}</p>
        {/if}
        {#if data.connectionError}
          <p class="text-error-500 text-sm" role="alert">已保存的项目无法读取：{data.connectionError}</p>
        {/if}
        <div class="flex flex-wrap gap-3">
          <button class="btn preset-filled-primary-500" type="submit">{data.report ? '重新检查并连接' : '连接项目'}</button>
        </div>
      </form>
      {#if data.connectedPath}
        <form method="POST" action="?/disconnect">
          <button class="btn preset-tonal-error-500" type="submit">断开当前项目</button>
        </form>
      {/if}
    </section>

    {#if data.report}
      {@const report = data.report}
      <section class="grid gap-4 sm:grid-cols-3">
        <div class="card bg-surface-100-900 p-5 shadow-sm">
          <p class="text-sm opacity-60">内容模式</p>
          <p class="mt-2 text-xl font-semibold">{modeLabel[report.mode]}</p>
        </div>
        <div class="card bg-surface-100-900 p-5 shadow-sm sm:col-span-2">
          <p class="text-sm opacity-60">Mizuki 根目录</p>
          <p class="mt-2 break-all font-mono text-sm">{report.root}</p>
        </div>
      </section>

      {#if report.readOnly}
        <section class="card border-warning-500/30 bg-warning-500/10 border p-5" role="status">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">当前工作区为只读状态</h2>
              <p class="mt-1 text-sm opacity-80">请先处理以下配置或等待安全同步阶段完成。</p>
            </div>
            <Dialog>
              <Dialog.Trigger class="btn preset-tonal-warning-500">查看原因</Dialog.Trigger>
              <Portal>
                <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60" />
                <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <Dialog.Content class="card bg-surface-100-900 w-full max-w-lg space-y-4 p-6 shadow-xl">
                    <Dialog.Title class="text-lg font-semibold">只读原因</Dialog.Title>
                    <Dialog.Description class="text-sm">当前阶段仅建立安全的项目连接，不执行内容同步或编辑。</Dialog.Description>
                    <ul class="list-disc space-y-2 pl-5 text-sm">
                      {#each report.warnings as warning}
                        <li>{warning}</li>
                      {/each}
                    </ul>
                    <Dialog.CloseTrigger class="btn preset-filled-primary-500">知道了</Dialog.CloseTrigger>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Portal>
            </Dialog>
          </div>
        </section>
      {:else if report.warnings.length}
        <section class="card bg-warning-500/10 space-y-2 p-5" role="status">
          {#each report.warnings as warning}<p class="text-sm">{warning}</p>{/each}
        </section>
      {/if}

      <section class="space-y-4">
        <div>
          <h2 class="text-xl font-semibold">原始内容位置</h2>
          <p class="mt-1 text-sm opacity-65">后续编辑将按这些原始位置写入，不会把同步生成的副本当作内容源。</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          {#each report.mappings as mapping}
            <article class="card bg-surface-100-900 space-y-2 p-5 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-medium">{mapping.label}</h3>
                <span class:opacity-60={!mapping.exists} class="badge preset-tonal text-xs">{mapping.exists ? '目录存在' : '目录待创建'}</span>
              </div>
              <p class="break-all font-mono text-xs opacity-75">{mapping.sourcePath}</p>
              {#if mapping.resolvedPath}<p class="break-all text-xs opacity-70">实际指向：<span class="font-mono">{mapping.resolvedPath}</span></p>{/if}
              {#if mapping.note}<p class="text-xs opacity-65">{mapping.note}</p>{/if}
            </article>
          {/each}
        </div>
      </section>
    {:else}
      <section class="card bg-surface-100-900 p-6 text-sm opacity-75">连接项目后，这里会显示内容模式与所有内容的原始目录。</section>
    {/if}
  </main>
</div>
