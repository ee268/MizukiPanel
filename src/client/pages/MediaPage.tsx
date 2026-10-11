import { Alert, Box, Button, Container, Snackbar, Stack, Typography } from "@mui/material";
import { ContentLoading } from "../components/ContentLoading";
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
        <Box data-page-motion="heading">
          <Typography variant="h4">媒体管理</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            按文件夹管理项目中的图片，上传到所选绝对路径；自动排除构建和依赖目录。
          </Typography>
        </Box>

        {media.error && (
          <Alert
            severity="error"
            onClose={media.data ? () => media.setError("") : undefined}
            action={
              !media.data && (
                <Button color="inherit" disabled={media.loading} onClick={() => void media.load()}>
                  重试
                </Button>
              )
            }
          >
            {media.error}
          </Alert>
        )}
        {!media.data && media.loading && (
          <ContentLoading
            kind="media"
            heading="正在展开媒体库"
            description="正在扫描项目图片与文件夹，准备目录和预览区域"
          />
        )}
        {readOnly && <Alert severity="warning">当前工作区只读，媒体写入已禁用。</Alert>}
        {media.data?.warnings.map((warning) => (
          <Alert severity="warning" key={warning}>
            {warning}
          </Alert>
        ))}

        {media.data && (
          <>
            <MediaUpload controller={media} readOnly={readOnly} />
            <MediaGallery
              items={media.visibleItems}
              folders={media.data?.folders ?? []}
              query={media.query}
              readOnly={readOnly}
              onQueryChange={media.setQuery}
              onCopy={(item) => void media.copy(item.reference, item.publicReference)}
              onDelete={media.setDeleting}
            />
          </>
        )}

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
