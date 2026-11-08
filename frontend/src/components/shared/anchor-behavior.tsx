"use client";
import { useEffect } from "react";

export function AnchorBehavior() {
  useEffect(() => {
    function revealContact() {
      if (window.location.hash === "#lien-he") {
        const contact = document.getElementById("lien-he");
        if (contact instanceof HTMLDetailsElement) contact.open = true;
      }
    }
    revealContact();
    window.addEventListener("hashchange", revealContact);
    return () => window.removeEventListener("hashchange", revealContact);
  }, []);
  return null;
}
