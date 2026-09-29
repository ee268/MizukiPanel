export interface FeatureEditorCallbacks {
  notify: (value: string) => void;
  fail: (value: string) => void;
}

export function resourceLabel(key: string) {
  return (
    {
      aboutText: "关于正文",
      friendsText: "友链说明",
      friends: "友链列表",
      diary: "日记条目",
      anime: "本地追番",
      animeSeasons: "季度内容",
      albums: "相册",
    }[key] ?? key
  );
}
