"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { LanguageSwitch } from "./language-switch";
import type { Locale } from "@/lib/i18n";

type NavLink = { href: string; label: string };
export function MobileNavigation({
  links,
  menuLabel,
  navigationLabel,
  exploreLabel,
  appUrl,
  locale,
  language,
}: {
  links: NavLink[];
  menuLabel: string;
  navigationLabel: string;
  exploreLabel: string;
  appUrl: string;
  locale: Locale;
  language: { path: string; label: string; viLabel: string; enLabel: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="mobile-trigger" aria-label={menuLabel}>
        <Menu aria-hidden="true" />
        <span>{menuLabel}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay" />
        <Dialog.Content className="mobile-panel" aria-describedby={undefined}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-semibold text-navy">
              {navigationLabel}
            </Dialog.Title>
            <Dialog.Close aria-label={menuLabel} className="menu-close">
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav aria-label={navigationLabel}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            ))}
          </nav>
          <LanguageSwitch locale={locale} {...language} />
          <a href={appUrl} className="mobile-explore">
            {exploreLabel}
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
