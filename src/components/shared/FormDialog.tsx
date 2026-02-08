import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import React, { useState } from "react";

interface FormDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode | ((opts: { close: () => void }) => React.ReactNode);
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const FormDialog = ({
  trigger,
  title,
  description,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: FormDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {typeof children === "function" ? children({ close }) : children}
      </DialogContent>
    </Dialog>
  );
};

export default FormDialog;
