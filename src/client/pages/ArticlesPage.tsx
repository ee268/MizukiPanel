import { Alert, Container, Snackbar, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArticleDialogs } from "../articles/ArticleDialogs";
import { ArticleEditor } from "../articles/ArticleEditor";
import { ArticleList } from "../articles/ArticleList";
import { ArticlePageHeader } from "../articles/ArticlePageHeader";
import { useArticles } from "../articles/useArticles";

export default function ArticlesPage() {
  const navigate = useNavigate();
  const articles = useArticles();

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2}>
        <ArticlePageHeader
          editing={Boolean(articles.selectedId)}
          mode={articles.report?.mode}
          count={articles.articles.length}
          readOnly={Boolean(articles.report?.readOnly)}
          onBack={articles.showList}
          onCreate={() => articles.setCreateOpen(true)}
        />

        {articles.error && (
          <Alert severity="error" onClose={() => articles.setError("")}>
            {articles.error}
          </Alert>
        )}
        {articles.report?.readOnly && (
          <Alert severity="warning">当前工作区只读，请先在工作区处理配置问题。</Alert>
        )}

        {articles.selectedId ? (
          <ArticleEditor
            article={articles.article}
            previewPath={articles.previewPath}
            frontmatter={articles.frontmatter}
            source={articles.source}
            mode={articles.mode}
            busy={articles.busy}
            readOnly={Boolean(articles.report?.readOnly)}
            onFrontmatterChange={articles.setFrontmatter}
            onSourceChange={articles.setSource}
            onModeChange={articles.setMode}
            onPreview={(path) => navigate(`/preview?path=${encodeURIComponent(path)}`)}
            onRename={() => articles.setRenameOpen(true)}
            onDelete={() => articles.setDeleteOpen(true)}
            onSaveFrontmatter={articles.saveFrontmatter}
            onSaveSource={articles.saveSource}
          />
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
