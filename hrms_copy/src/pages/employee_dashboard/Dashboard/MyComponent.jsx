import { useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmationModal from "../../../components/ConfirmationModal";

function MyComponent() {
  const { t } = useTranslation("dashboard");
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    console.log("Item deleted!");
    setShowConfirm(false);
  };

  return (
    <div>
      <button onClick={() => setShowConfirm(true)}>
        {t("confirm.deleteButton")}
      </button>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        type="status"
        title={t("confirm.deleteTitle")}
        message={t("confirm.deleteMessage")}
        confirmText={t("confirm.deleteConfirm")}
      />
    </div>
  );
}

export default MyComponent;
