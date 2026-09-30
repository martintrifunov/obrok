import { useState } from "react";
import TermsAndPrivacyModal from "@/components/ui/TermsAndPrivacyModal";

const TERMS_ACCEPTED_KEY = "obrok_terms_accepted";

const readAccepted = () => {
  try {
    return localStorage.getItem(TERMS_ACCEPTED_KEY) === "true";
  } catch {
    return false;
  }
};

const ConsentGate = ({ children }) => {
  const [hasAccepted, setHasAccepted] = useState(readAccepted);

  const handleAccept = () => {
    try {
      localStorage.setItem(TERMS_ACCEPTED_KEY, "true");
    } catch {
      // Acceptance then lasts for this page load only.
    }
    setHasAccepted(true);
  };

  if (!hasAccepted) {
    return <TermsAndPrivacyModal open onAccept={handleAccept} />;
  }

  return children;
};

export default ConsentGate;
