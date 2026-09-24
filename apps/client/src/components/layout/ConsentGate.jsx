import { useState } from "react";
import TermsAndPrivacyModal from "@/components/ui/TermsAndPrivacyModal";

const TERMS_ACCEPTED_KEY = "obrok_terms_accepted";

const ConsentGate = ({ children }) => {
  const [hasAccepted, setHasAccepted] = useState(
    () => localStorage.getItem(TERMS_ACCEPTED_KEY) === "true",
  );

  const handleAccept = () => {
    localStorage.setItem(TERMS_ACCEPTED_KEY, "true");
    setHasAccepted(true);
  };

  if (!hasAccepted) {
    return <TermsAndPrivacyModal open onAccept={handleAccept} />;
  }

  return children;
};

export default ConsentGate;
