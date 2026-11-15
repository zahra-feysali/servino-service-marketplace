"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Direction } from "radix-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/** App-wide client providers: RTL direction for Radix, theme, TanStack Query, tooltips, toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <Direction.DirectionProvider dir="rtl">
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {children}
            <Toaster position="top-center" dir="rtl" richColors closeButton />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </Direction.DirectionProvider>
  );
}
