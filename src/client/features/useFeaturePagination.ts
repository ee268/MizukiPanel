import { useState } from "react";

export function useFeaturePagination(count: number, initialSize = 5) {
  const [requestedPage, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);
  const page = Math.max(0, Math.min(requestedPage, Math.max(0, Math.ceil(count / pageSize) - 1)));
  const start = page * pageSize;
  return {
    page,
    pageSize,
    start,
    end: start + pageSize,
    setPage,
    changePageSize: (size: number) => {
      setPageSize(size);
      setPage(0);
    },
    reveal: (index: number) => setPage(Math.max(0, Math.floor(index / pageSize))),
  };
}
