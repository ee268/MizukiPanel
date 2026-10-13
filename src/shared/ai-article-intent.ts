import type { AiEditTarget } from "./ai-writing";

/** A narrow fast path for explicit reading commands; ambiguous requests still use AI routing. */
export function isExplicitArticleRead(instruction: string): boolean {
  const source = instruction.trim();
  if (/^(?:请\s*)?(?:不要|不必|无需|不用|请勿|别)\s*(?:读取|阅读|查看|分析|总结|概括)/.test(source))
    return false;
  const command = source
    .replace(
      /(?:不要|不必|无需|不用|不需要|禁止|请勿|别)\s*(?:修改|编辑|改写|润色|改动)(?:正文|文章)?/g,
      "",
    )
    .replace(/^[\s，,。]*(?:(?:请|麻烦|帮我|给我|只|仅|先)\s*)+/u, "");
  if (
    /修改|编辑|改写|润色|改动|续写|扩写|删改|替换|重写|补充|插入|新增|删除|\b(?:edit|rewrite|revise|polish|replace|delete|insert)\b/i.test(
      command,
    )
  )
    return false;
  if (
    /(?:当前|这篇|该篇)文章|文中|选区|选中|这段|文章(?:内容|主要|讲)/.test(command) &&
    /什么|哪些|为何|为什么|如何|怎么|怎样|是否|有没有|哪里|多少/.test(command)
  )
    return true;
  if (
    /^(?:读取|阅读|查看|看看|看一下|看下|读一下|概括|总结|分析|解释|检查|评价|展示|显示|列出|说说|复述)/.test(
      command,
    ) &&
    /文章|正文|全文|本文|这篇|该篇|文中|选区|选中|这段|本段|段落|frontmatter|元信息|元数据/i.test(
      command,
    )
  )
    return true;
  return (
    /^(?:please\s+)?(?:read|review|summari[sz]e|analy[sz]e|explain|show)\b/i.test(command) &&
    /\b(?:article|draft|selected text|selection|passage)\b/i.test(command)
  );
}
export function explicitFrontmatterEdit(instruction: string): AiEditTarget | undefined {
  if (
    /(?:不要|无需|不需要|别|禁止|请勿)\s*(?:修改|编辑|改写|改动)\s*(?:frontmatter|元数据|元信息)/i.test(
      instruction,
    )
  )
    return;
  if (
    !/frontmatter|元数据|元信息|文章标题|文章摘要|发布日期|发布状态|更新日期|标签|分类|\b(?:title|description|tags|draft|published|pubDate|updatedDate|category|author)\b/i.test(
      instruction,
    ) ||
    !/修改|改为|设为|设置|更新|生成|提取|调整|新增|添加|删除|填写|完善|补充|\b(?:set|change|update|generate|add|remove|edit)\b/i.test(
      instruction,
    )
  )
    return;
  const bodyEdit =
    /(?:润色|续写|扩写|删改|改写|修改|调整|重写)[^。！？]{0,10}(?:正文|段落|开头|结尾)|(?:正文|段落|开头|结尾)[^。！？]{0,10}(?:润色|续写|扩写|删改|改写|修改|调整|重写)/.test(
      instruction,
    );
  return bodyEdit ? "both" : "frontmatter";
}
