import { AlertDialog } from "radix-ui";
import { create } from "zustand";

type Confirmation = {
  title: string;
  description: string;
  label: string;
  destructive?: boolean;
};

const useConfirmation = create<{ request: (Confirmation & { resolve: (confirmed: boolean) => void; trigger: HTMLElement | null }) | null }>(() => ({ request: null }));

export function confirmAction(confirmation: Confirmation): Promise<boolean> {
  useConfirmation.getState().request?.resolve(false);
  return new Promise((resolve) => useConfirmation.setState({
    request: { ...confirmation, resolve, trigger: document.activeElement as HTMLElement | null },
  }));
}

export function ConfirmDialog() {
  const request = useConfirmation((state) => state.request);
  if (!request) return null;
  const close = (confirmed: boolean) => {
    useConfirmation.setState({ request: null });
    request.resolve(confirmed);
  };
  return <AlertDialog.Root open onOpenChange={(open) => { if (!open) close(false); }}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="dialog-overlay confirmation-overlay" />
      <AlertDialog.Content className="modal confirmation-dialog" onCloseAutoFocus={(event) => {
        event.preventDefault();
        request.trigger?.focus();
      }}>
        <AlertDialog.Title className="dialog-title">{request.title}</AlertDialog.Title>
        <AlertDialog.Description className="dialog-description">{request.description}</AlertDialog.Description>
        <div className="modal-actions">
          <AlertDialog.Cancel className="btn outline">Cancelar</AlertDialog.Cancel>
          <button className={`btn${request.destructive ? " destructive" : ""}`} onClick={() => close(true)}>{request.label}</button>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
