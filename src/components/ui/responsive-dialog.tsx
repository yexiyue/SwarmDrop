/**
 * ResponsiveDialog
 * 桌面端渲染 Dialog，移动端渲染 Drawer
 */

import * as React from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { showCloseButton, ...rest } = props;

  if (isMobile) {
    return (
      <DrawerContent className={cn(className)} {...rest}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={cn(className)} showCloseButton={showCloseButton} {...rest}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  if (isMobile) {
    return <DrawerHeader className={cn(className)} {...props} />;
  }

  return <DialogHeader className={cn(className)} {...props} />;
}

function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  if (isMobile) {
    return <DrawerFooter className={cn(className)} {...props} />;
  }

  return <DialogFooter className={cn(className)} {...props} />;
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  if (isMobile) {
    return <DrawerTitle className={cn(className)} {...props} />;
  }

  return <DialogTitle className={cn(className)} {...props} />;
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  if (isMobile) {
    return <DrawerDescription className={cn(className)} {...props} />;
  }

  return <DialogDescription className={cn(className)} {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
