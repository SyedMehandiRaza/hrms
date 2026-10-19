import { useCallback, useEffect, useRef, useState } from "react";

// Load data for a screen and track its loading / error state.
//
//   const { data, loading, error, reload } = useApiQuery(() => getCompany(), []);
//
// fetcher : () => Promise<data> (a src/api/* function)
// deps    : primitives that should trigger a reload (page, search, id ...)
// reload(): fetch again (the Retry button, or after a save)
// Older answers that arrive after a newer request started are ignored.
export default function useApiQuery(fetcher, deps = []) {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([deps, nonce]);
  const [result, setResult] = useState({ key: null, data: undefined, error: null });

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then(
        (data) => alive && setResult({ key, data, error: null }),
        (error) => alive && setResult((prev) => ({ key, data: prev.data, error })),
      );
    return () => {
      alive = false;
    };
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: result.data,
    error: result.key === key ? result.error : null,
    loading: result.key !== key,
    reload,
    // Replace the data locally (e.g. after a save returned the fresh record).
    setData: (data) => setResult({ key, data, error: null }),
  };
}
