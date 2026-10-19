import { useCallback, useEffect, useState } from "react";

// Fetch on mount and whenever `key` changes (no synchronous setState in the
// effect — `loading` is derived from which request the data belongs to).
//
//   const { data, error, loading, reload, setData } = useRemote(() => api(id), id);
//
// The previous data stays while a reload / key change is in flight.
export default function useRemote(fetcher, key) {
  const [nonce, setNonce] = useState(0);
  const reqKey = `${String(key)}|${nonce}`;
  const [state, setState] = useState({ key: null, data: undefined, error: null });

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(fetcher)
      .then(
        (data) => alive && setState({ key: reqKey, data, error: null }),
        (error) => alive && setState((s) => ({ key: reqKey, data: s.data, error })),
      );
    return () => {
      alive = false;
    };
    // the fetcher is re-created every render; `key` says when to refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (next) => setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next })),
    [],
  );

  return { data: state.data, error: state.error, loading: state.key !== reqKey, reload, setData };
}
