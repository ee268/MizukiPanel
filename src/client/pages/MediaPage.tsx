import { Alert, Box, Container, Snackbar, Stack, Typography } from "@mui/material";
import { useNoticeDuration } from "../settings/useNoticeDuration";
import { DeleteMediaDialog } from "../media/DeleteMediaDialog";
import { MediaGallery } from "../media/MediaGallery";
import { MediaUpload } from "../media/MediaUpload";
import { useMedia } from "../media/useMedia";
import { useCurrentProjectReadOnly } from "../workspace/WorkspaceSessionProvider";

export default function MediaPage() {
  const noticeDuration = useNoticeDuration();
  const media = useMedia();
  const readOnly = useCurrentProjectReadOnly(
    media.data?.report.root,
    Boolean(media.data?.report.readOnly),
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">媒体管理</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理公共图片和与文章同目录的相对资源。
          </Typography>
        </Box>

        {media.error && (
          <Alert severity="error" onClose={() => media.setError("")}>
            {media.error}
          </Alert>
        )}
        {readOnly && <Alert severity="warning">当前工作区只读，媒体写入已禁用。</Alert>}

        <MediaUpload
          scope={media.scope}
          articles={media.data?.articles ?? []}
          articleId={media.articleId}
          folder={media.folder}
          file={media.file}
          busy={media.busy}
          readOnly={readOnly}
          onScopeChange={media.setScope}
          onArticleChange={media.setArticleId}
          onFolderChange={media.setFolder}
          onFileChange={media.setFile}
          onSubmit={media.upload}
        />
        <MediaGallery
          items={media.visibleItems}
          scope={media.scope}
          query={media.query}
          readOnly={readOnly}
          onScopeChange={media.setScope}
          onQueryChange={media.setQuery}
          onCopy={media.copy}
          onDelete={media.setDeleting}
        />

        <DeleteMediaDialog
          item={media.deleting}
          busy={media.busy}
          onClose={() => media.setDeleting(null)}
          onConfirm={media.remove}
        />
        <Snackbar
          open={Boolean(media.notice)}
          autoHideDuration={noticeDuration}
          onClose={() => media.setNotice("")}
          message={media.notice}
        />
      </Stack>
    </Container>
  );
}
