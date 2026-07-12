"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Global toast host.
 *
 * - Fixed light theme (app is light-only; no ThemeProvider required)
 * - High z-index so toasts appear above dialogs/sheets (z-50)
 * - Solid card surface + readable title/description contrast
 * - Top-right with safe offset so body overflow-hidden does not clip them
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-right"
      closeButton
      richColors
      expand
      visibleToasts={4}
      gap={10}
      offset={{ top: 16, right: 16 }}
      mobileOffset={{ top: 12, right: 12, left: 12 }}
      duration={5000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !pointer-events-auto !flex !w-[min(22rem,calc(100vw-1.5rem))] !items-start !gap-3 !rounded-xl !border !border-border !bg-card !p-4 !pr-10 !text-sm !text-card-foreground !shadow-lg !ring-1 !ring-black/5",
          title: "!text-sm !font-semibold !text-foreground !leading-snug",
          description: "!text-sm !text-muted-foreground !leading-snug !opacity-100",
          actionButton:
            "!bg-primary !text-primary-foreground !rounded-md !px-2.5 !py-1 !text-xs !font-medium",
          cancelButton: "!bg-muted !text-foreground !rounded-md !px-2.5 !py-1 !text-xs",
          closeButton:
            "!border-border !bg-card !text-foreground !opacity-100 hover:!bg-muted !left-auto !right-2 !top-2 !size-6",
          success:
            "!border-accent-green/30 !bg-card !text-foreground [&_[data-icon]]:!text-accent-green",
          error:
            "!border-destructive/35 !bg-card !text-foreground [&_[data-icon]]:!text-destructive",
          warning:
            "!border-accent-orange/35 !bg-card !text-foreground [&_[data-icon]]:!text-accent-orange",
          info: "!border-accent-sky/35 !bg-card !text-foreground [&_[data-icon]]:!text-accent-sky",
        },
      }}
      style={
        {
          // Ensure the toaster portal sits above dialogs (z-50) and sheets.
          zIndex: 9999,
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-border":
            "color-mix(in oklab, var(--color-accent-green, #1aae39) 30%, transparent)",
          "--success-text": "var(--card-foreground)",
          "--error-bg": "var(--card)",
          "--error-border": "color-mix(in oklab, var(--destructive) 35%, transparent)",
          "--error-text": "var(--card-foreground)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
