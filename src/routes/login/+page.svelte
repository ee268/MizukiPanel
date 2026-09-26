<script lang="ts">
  let { form } = $props();
</script>

<svelte:head>
  <title>登录 · MizukiPanel</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="bg-surface-50-950 flex min-h-screen items-center justify-center px-4 py-10">
  <section class="card bg-surface-100-900 w-full max-w-md space-y-6 p-7 shadow-xl sm:p-9">
    <div class="space-y-2">
      <span class="badge preset-filled-primary-500">本机管理面板</span>
      <h1 class="text-3xl font-semibold">MizukiPanel</h1>
      <p class="text-sm opacity-70">输入本次启动时终端显示的访问令牌。</p>
    </div>

    <form method="POST" class="space-y-5">
      <label class="label block space-y-2">
        <span>访问令牌</span>
        <input class="input w-full" type="password" name="token" autocomplete="off" required />
      </label>
      {#if form?.message}
        <p class="text-error-500 text-sm" role="alert">{form.message}</p>
      {/if}
      <button class="btn preset-filled-primary-500 w-full" type="submit">进入面板</button>
    </form>
  </section>
</main>
