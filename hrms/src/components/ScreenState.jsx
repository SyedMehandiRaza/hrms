// Shared loading / error / empty states for API-driven screens, built from the
// existing pieces (Loader, and the LoadError / EmptyState blocks of the
// Financial Year screens) so every screen looks the same.
//
//   const { data, loading, error, reload } = useApiQuery(() => listDepartments(params), [page, search]);
//   <ScreenState loading={loading} error={error} onRetry={reload}
//                empty={!data?.items.length} emptyTitle={t("departments.empty")}>
//     <Table rows={data.items} />
//   </ScreenState>
//
// Tables: render <TableLoader colSpan={n} /> (components/Loader) inside <tbody>
// instead, and <ScreenError>/<ScreenEmpty> in a full-width cell.
import Loader from "./Loader";
import { LoadError, EmptyState } from "./yearEnd/shared";
import { apiErrorMessage } from "../utils/apiError";

export const ScreenLoader = Loader;

// The server's `message` (or the generic text) with a Retry button.
export function ScreenError({ error, message, onRetry }) {
  return <LoadError message={message || apiErrorMessage(error)} onRetry={onRetry} />;
}

export const ScreenEmpty = EmptyState;

export default function ScreenState({
  loading,
  error,
  onRetry,
  empty = false,
  emptyTitle,
  emptyHint,
  emptyIcon,
  loadingLabel,
  children,
}) {
  if (loading) return <Loader label={loadingLabel} />;
  if (error) return <ScreenError error={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle} hint={emptyHint} {...(emptyIcon ? { icon: emptyIcon } : {})} />;
  return children;
}
