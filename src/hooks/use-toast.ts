// Inspired by https://github.com/shadcn-ui/ui/blob/main/apps/www/hooks/use-toast.ts
import { toast as sonnerToast } from "sonner";

type Toast = {
  id: string;
  dismiss: () => void;
  update: (props: Record<string, any>) => void;
};

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

const toast = (props: ToastProps): Toast => {
  const { title, description, variant } = props;
  if (variant === "destructive") {
    return sonnerToast.error(title, { description }) as unknown as Toast;
  }
  return sonnerToast(title, { description }) as unknown as Toast;
};

function useToast() {
  return { toast };
}

export { toast, useToast };
