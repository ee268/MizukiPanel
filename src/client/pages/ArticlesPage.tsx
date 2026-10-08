import { lazy, Suspense } from "react";
import { Alert, Button, Container, Paper, Snackbar, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArticleDialogs } from "../articles/ArticleDialogs";
import { ArticleLoading } from "../articles/ArticleLoading";
import { ArticleList } from "../articles/ArticleList";
import { ArticlePageHeader } from "../articles/ArticlePageHeader";
import { useArticles } from "../articles/useArticles";

const ArticleEditor = lazy(() =>
  import("../articles/ArticleEditor").then((module) => ({ default: module.ArticleEditor })),
);
const MarkdownTutorial = lazy(() =>
  import("../articles/MarkdownTutorial").then((module) => ({ default: module.MarkdownTutorial })),
);

export default function ArticlesPage() {
  const navigate = useNavigate();
  const articles = useArticles();
  const selectedTitle = articles.articles.find((item) => item.id === articles.selectedId)?.title;

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2}>
        <ArticlePageHeader
          editing={articles.tutorialOpen || Boolean(articles.selectedId)}
          mode={articles.report?.mode}
          count={articles.articles.length}
          readOnly={Boolean(articles.report?.readOnly)}
          onBack={articles.showList}
          onTutorial={articles.openTutorial}
          onCreate={() => articles.setCreateOpen(true)}
        />

        {articles.error && (
          <Alert severity="error" onClose={() => articles.setError("")}>
            {articles.error}
          </Alert>
        )}
        {articles.report?.readOnly && !articles.tutorialOpen && (
          <Alert severity="warning">当前工作区只读，请先在工作区处理配置问题。</Alert>
        )}

        {articles.tutorialOpen ? (
          <Suspense fallback={<ArticleLoading title="Markdown 教程" phase="preparing" />}>
            <MarkdownTutorial projectRoot={articles.report?.root ?? ""} />
          </Suspense>
        ) : articles.selectedId ? (
          articles.articleLoadError ? (
            <Paper variant="outlined" sx={{ p: 4 }}>
              <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
                <Typography variant="h6">文章暂时无法打开</Typography>
                <Typography color="text.secondary">{articles.articleLoadError}</Typography>
                <Button variant="contained" onClick={articles.retryArticle}>
                  重新读取
                </Button>
              </Stack>
            </Paper>
          ) : articles.articleLoading || articles.article?.id !== articles.selectedId ? (
            <ArticleLoading title={selectedTitle} />
          ) : (
            <Suspense fallback={<ArticleLoading title={selectedTitle} phase="preparing" />}>
              <ArticleEditor
                article={articles.article}
                projectRoot={articles.report?.root ?? ""}
                previewPath={articles.previewPath}
                frontmatter={articles.frontmatter}
                source={articles.source}
                mode={articles.mode}
                busy={articles.busy}
                dirty={articles.dirty}
                sourceDirty={articles.sourceDirty}
                readOnly={Boolean(articles.report?.readOnly)}
                onFrontmatterChange={articles.setFrontmatter}
                onSourceChange={articles.setSource}
                onModeChange={articles.setMode}
                onPreview={(path) => {
                  if (
                    articles.dirty &&
                    !window.confirm("当前文章有未保存的修改，确定离开并查看真实预览吗？")
                  ) {
                    return;
                  }
                  navigate(`/preview?path=${encodeURIComponent(path)}`);
                }}
                onRename={() => articles.setRenameOpen(true)}
                onDelete={() => articles.setDeleteOpen(true)}
                onSaveFrontmatter={articles.saveFrontmatter}
                onSaveDocument={articles.saveDocument}
                onSaveBody={articles.saveBody}
              />
            </Suspense>
          )
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
          />
        )}
      </Stack>

      <ArticleDialogs
        article={articles.article}
        busy={articles.busy}
        createOpen={articles.createOpen}
        renameOpen={articles.renameOpen}
        deleteOpen={articles.deleteOpen}
        onCreateOpenChange={articles.setCreateOpen}
        onRenameOpenChange={articles.setRenameOpen}
        onDeleteOpenChange={articles.setDeleteOpen}
        onCreate={articles.createArticle}
        onRename={articles.renameArticle}
        onDelete={articles.removeArticle}
      />
      <Snackbar
        open={Boolean(articles.notice)}
        autoHideDuration={3000}
        onClose={() => articles.setNotice("")}
        message={articles.notice}
      />
    </Container>
  );
}
