import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useBlocker, useLocation, useNavigationType, useSearchParams } from "react-router-dom";
import { useNoticeDuration } from "../settings/useNoticeDuration";
import { ConfigCatalog } from "../config/ConfigCatalog";
import { useConfigs } from "../config/useConfigs";
import { ContentLoading } from "../components/ContentLoading";

const ConfigEditor = lazy(() =>
  import("../config/ConfigEditor").then((module) => ({ default: module.ConfigEditor })),
);

function LoadingDetails() {
  return (
    <ContentLoading
      heading="正在展开站点配置"
      description="正在准备配置内容与编辑区域"
      kind="settings"
    />
  );
}

export default function ConfigPage() {
  const noticeDuration = useNoticeDuration(5000);
  const configs = useConfigs();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    // Ignore older acknowledgements from our own search updates, but honor history navigation.
    if (
      navigationType !== "POP" &&
      pendingQuery.current !== null &&
      urlQuery !== pendingQuery.current
    )
      return;
    pendingQuery.current = null;
    setQuery(urlQuery);
  }, [location.key, navigationType, urlQuery]);
  function changeQuery(value: string) {
    setQuery(value);
    if (value === urlQuery && pendingQuery.current === null) return;
    pendingQuery.current = value;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  }
  const catalogScroll = useRef(0);
  const catalogVisible = useRef(!configs.selected);
  const restoringScroll = useRef(false);
  catalogVisible.current = !configs.selected;
  const previousSelected = useRef(configs.selected);
  const dirty = Boolean(configs.document && configs.initializer !== configs.document.initializer);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const currentKey = new URLSearchParams(currentLocation.search).get("key");
    const nextKey = new URLSearchParams(nextLocation.search).get("key");
    return (
      (dirty || configs.busy || configs.backingUp) &&
      (currentLocation.pathname !== nextLocation.pathname || currentKey !== nextKey)
    );
  });
  useLayoutEffect(() => {
    const before = previousSelected.current;
    previousSelected.current = configs.selected;
    if (before === configs.selected) return;
    restoringScroll.current = true;
    const top = configs.selected ? 0 : catalogScroll.current;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: "instant" });
      restoringScroll.current = false;
      if (!configs.selected) catalogScroll.current = window.scrollY;
    });
    return () => {
      cancelAnimationFrame(frame);
      restoringScroll.current = false;
    };
  }, [configs.selected]);
  useEffect(() => {
    const rememberScroll = () => {
      if (catalogVisible.current && !restoringScroll.current)
        catalogScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, []);
  const selectedValid = configs.configs.some((item) => item.key === configs.selected);
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        {configs.selected ? (
          <Button
            startIcon={<ArrowBackOutlined />}
            onClick={configs.close}
            disabled={configs.busy || configs.backingUp}
            sx={{ alignSelf: "flex-start" }}
          >
            返回配置目录
          </Button>
        ) : (
          <Box data-page-motion="heading">
            <Typography variant="h4" component="h1">
              站点配置
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              搜索并选择配置，编辑前自动备份，每项保留最近 5 份。
            </Typography>
          </Box>
        )}
        {configs.error && (
          <Alert severity="error" onClose={() => configs.setError("")}>
            {configs.error}
          </Alert>
        )}
        {configs.report?.readOnly && (
          <Alert severity="warning">当前工作区只读，配置只能查看。</Alert>
        )}
        {configs.selected ? (
          selectedValid &&
          !configs.indexLoading &&
          !configs.busy &&
          !configs.document &&
          configs.error ? (
            <Alert
              severity="info"
              action={<Button onClick={() => void configs.reload()}>重试</Button>}
            >
              配置详情读取失败，可以重试或返回配置目录。
            </Alert>
          ) : configs.indexLoading || selectedValid ? (
            <Suspense fallback={<LoadingDetails />}>
              <ConfigEditor
                document={configs.document}
                initializer={configs.initializer}
                busy={configs.busy}
                backingUp={configs.backingUp}
                backups={configs.backups}
                onInitializerChange={configs.changeInitializer}
                onSave={configs.save}
                onDiscard={configs.discardChanges}
                onClear={() => configs.changeInitializer("{}")}
                onRestore={configs.restore}
              />
            </Suspense>
          ) : (
            <Alert severity="info">没有找到此配置，请返回目录选择其他配置。</Alert>
          )
        ) : configs.indexLoading ? (
          <LoadingDetails />
        ) : (
          <ConfigCatalog
            groups={configs.groups}
            query={query}
            onQueryChange={changeQuery}
            onSelect={(key) => {
              catalogScroll.current = window.scrollY;
              configs.select(key);
            }}
          />
        )}
      </Stack>
      <Dialog
        open={blocker.state === "blocked"}
        onClose={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogTitle>{dirty ? "配置有未保存的修改" : "配置正在处理中"}</DialogTitle>
        <DialogContent>
          {dirty
            ? "离开前可以保存修改，也可以放弃本次编辑。"
            : "请等待当前保存或备份完成，再离开此配置。"}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            继续编辑
          </Button>
          <Button
            disabled={configs.busy || configs.backingUp}
            onClick={() => {
              if (blocker.state === "blocked") {
                configs.discardChanges();
                blocker.proceed();
              }
            }}
          >
            放弃并离开
          </Button>
          {dirty && (
            <Button
              variant="contained"
              disabled={configs.busy || configs.backingUp || configs.document?.readOnly}
              onClick={async () => {
                if (blocker.state === "blocked" && (await configs.save())) blocker.proceed();
              }}
            >
              保存并离开
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(configs.notice)}
        autoHideDuration={noticeDuration}
        onClose={() => configs.setNotice("")}
        message={configs.notice}
      />
    </Container>
  );
}
