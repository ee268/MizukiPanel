import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Container, Paper, Snackbar, Stack, Typography } from "@mui/material";
import { useNoticeDuration } from "../settings/useNoticeDuration";
import { useNavigate } from "react-router-dom";
import { ArticleDialogs } from "../articles/ArticleDialogs";
import { ArticleDeleteDialog } from "../articles/ArticleDeleteDialog";
import { ArticleLoading } from "../articles/ArticleLoading";
import { ArticleList } from "../articles/ArticleList";
import { ArticlePageHeader } from "../articles/ArticlePageHeader";
import { useArticles } from "../articles/useArticles";
import { DraftLibrary, DraftRecovery } from "../articles/DraftRecovery";

const ArticleEditor = lazy(() =>
  import("../articles/ArticleEditor").then((module) => ({ default: module.ArticleEditor })),
);
const MarkdownTutorial = lazy(() =>
  import("../articles/MarkdownTutorial").then((module) => ({ default: module.MarkdownTutorial })),
);

export default function ArticlesPage() {
  const noticeDuration = useNoticeDuration(3000);
  const navigate = useNavigate();
  const articles = useArticles();
  const selectedTitle = articles.articles.find((item) => item.id === articles.selectedId)?.title;
  const editing = articles.tutorialOpen || Boolean(articles.selectedId);
  const [preparedKey, setPreparedKey] = useState<string | null>(null);
  const editorKey = articles.tutorialOpen
    ? `tutorial:${articles.report?.root ?? ""}`
    : `${articles.report?.root ?? ""}:${articles.selectedId}:${articles.articleLoadVersion}`;
  const reading = articles.tutorialOpen
    ? !articles.report && !articles.error
    : articles.articleLoading || articles.article?.id !== articles.selectedId;
  const loading =
    editing &&
    (articles.tutorialOpen || !articles.articleLoadError) &&
    (reading || preparedKey !== editorKey);
  const handleLoadEnd = useCallback(() => setPreparedKey(editorKey), [editorKey]);
  useEffect(() => {
    if (!editing) setPreparedKey(null);
  }, [editing]);

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2}>
        <ArticlePageHeader
          editing={editing}
          mode={articles.report?.mode}
          count={articles.articles.length}
          readOnly={Boolean(articles.report?.readOnly)}
          onBack={articles.showList}
          onTutorial={articles.openTutorial}
          onCreate={() => articles.setCreateOpen(true)}
        />
        <DraftLibrary
          projectKey={articles.projectKey}
          article={articles.article}
          articles={articles.articles}
          onOpenArticle={articles.choose}
        />
        {!articles.tutorialOpen && articles.article && (
          <DraftRecovery
            key={articles.article.id}
            entries={articles.drafts.entries}
            article={articles.article}
            dirty={articles.dirty}
            onRestore={articles.restoreDraft}
            onDiscard={articles.drafts.discard}
          />
        )}
        {articles.drafts.error && <Alert severity="warning">{articles.drafts.error}</Alert>}
        {!articles.tutorialOpen && articles.article && (
          <Typography variant="caption" color="text.secondary">
            {articles.drafts.status}
          </Typography>
        )}

        {articles.error && (
          <Alert severity="error" onClose={() => articles.setError("")}>
            {articles.error}
          </Alert>
        )}
        {articles.report?.readOnly && !articles.tutorialOpen && (
          <Alert severity="warning">当前工作区只读，请先在工作区处理配置问题。</Alert>
        )}

        {editing ? (
          <Box data-page-motion="content" sx={{ position: "relative" }} aria-busy={loading}>
            {loading && (
              <ArticleLoading
                title={
                  articles.tutorialOpen
                    ? "Markdown 教程"
                    : (selectedTitle ?? articles.article?.title)
                }
              />
            )}
            <Box
              inert={loading}
              aria-hidden={loading || undefined}
              sx={
                loading
                  ? {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      maxHeight: "100%",
                      overflow: "hidden",
                      visibility: "hidden",
                    }
                  : undefined
              }
            >
              {articles.tutorialOpen ? (
                reading ? null : (
                  <Suspense fallback={null}>
                    <MarkdownTutorial
                      projectRoot={articles.report?.root ?? ""}
                      onLoadEnd={handleLoadEnd}
                    />
                  </Suspense>
                )
              ) : articles.articleLoadError ? (
                <Paper variant="outlined" sx={{ p: 4 }}>
                  <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
                    <Typography variant="h6">文章暂时无法打开</Typography>
                    <Typography color="text.secondary">{articles.articleLoadError}</Typography>
                    <Button variant="contained" onClick={articles.retryArticle}>
                      重新读取
                    </Button>
                  </Stack>
                </Paper>
              ) : reading ? null : (
                <Suspense fallback={null}>
                  <ArticleEditor
                    article={articles.article}
                    sourceRevision={articles.sourceRevision}
                    editorVersion={articles.editorVersion}
                    registerEditorFlush={articles.registerEditorFlush}
                    projectRoot={articles.report?.root ?? ""}
                    previewPath={articles.previewPath}
                    frontmatter={articles.frontmatter}
                    source={articles.source}
                    mode={articles.mode}
                    busy={articles.busy}
                    autosaving={articles.autosaving}
                    dirty={articles.dirty}
                    sourceDirty={articles.sourceDirty}
                    readOnly={Boolean(articles.report?.readOnly)}
                    onFrontmatterChange={articles.setFrontmatter}
                    onSourceChange={articles.setSource}
                    onModeChange={articles.setMode}
                    onPreview={(path) => {
                      navigate(`/preview?path=${encodeURIComponent(path)}`);
                    }}
                    onRename={() => articles.setRenameOpen(true)}
                    onDelete={() => {
                      if (articles.article) void articles.deletion.open(articles.article);
                    }}
                    onSaveFrontmatter={articles.saveFrontmatter}
                    onSaveDocument={articles.saveDocument}
                    onSaveBody={articles.saveBody}
                    onLoadEnd={handleLoadEnd}
                  />
                </Suspense>
              )}
            </Box>
          </Box>
        ) : (
          <ArticleList
            articles={articles.pagedArticles}
            page={articles.page}
            pageCount={articles.pageCount}
            query={articles.query}
            filter={articles.filter}
            onQueryChange={articles.setQuery}
            onFilterChange={articles.setFilter}
            onPageChange={articles.setPage}
            onSelect={articles.choose}
            onDelete={(item) => void articles.deletion.open(item)}
            readOnly={!articles.report || Boolean(articles.report.readOnly)}
            busy={articles.busy}
          />
        )}
      </Stack>

      <ArticleDialogs
        article={articles.article}
        busy={articles.busy}
        createOpen={articles.createOpen}
        renameOpen={articles.renameOpen}
        onCreateOpenChange={articles.setCreateOpen}
        onRenameOpenChange={articles.setRenameOpen}
        onCreate={articles.createArticle}
        readOnly={Boolean(articles.report?.readOnly)}
        onRename={articles.renameArticle}
      />
      {articles.deletion.target && (
        <ArticleDeleteDialog
          target={articles.deletion.target}
          loading={articles.deletion.loading}
          error={articles.deletion.error}
          busy={articles.busy}
          readOnly={Boolean(articles.report?.readOnly)}
          dirty={articles.dirty && articles.deletion.target.id === articles.article?.id}
          onClose={articles.deletion.close}
          onDelete={(recycle) => void articles.removeArticle(recycle)}
        />
      )}
      <Snackbar
        open={Boolean(articles.notice)}
        autoHideDuration={noticeDuration}
        onClose={() => articles.setNotice("")}
        message={articles.notice}
      />
    </Container>
  );
}
