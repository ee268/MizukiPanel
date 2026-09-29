import AddOutlined from "@mui/icons-material/AddOutlined";
import { Alert, Box, Button, Container, Snackbar, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArticleDialogs } from "../articles/ArticleDialogs";
import { ArticleEditor } from "../articles/ArticleEditor";
import { ArticleList } from "../articles/ArticleList";
import { useArticles } from "../articles/useArticles";

export default function ArticlesPage() {
  const navigate = useNavigate();
  const articles = useArticles();

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <Box>
            <Typography variant="h4">文章管理</Typography>
            <Typography color="text.secondary">
              {articles.report?.mode === "external" ? "独立内容仓库" : "本地内容"} ·{" "}
              {articles.articles.length} 篇文章
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => articles.setCreateOpen(true)}
            disabled={articles.report?.readOnly}
          >
            新建文章
          </Button>
        </Stack>

        {articles.error && (
          <Alert severity="error" onClose={() => articles.setError("")}>
            {articles.error}
          </Alert>
        )}
        {articles.report?.readOnly && (
          <Alert severity="warning">当前工作区只读，请先在工作区处理配置问题。</Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0,1fr)" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <ArticleList
            articles={articles.visibleArticles}
            selectedId={articles.selectedId}
            query={articles.query}
            filter={articles.filter}
            onQueryChange={articles.setQuery}
            onFilterChange={articles.setFilter}
            onSelect={articles.choose}
          />
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
        </Box>
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
