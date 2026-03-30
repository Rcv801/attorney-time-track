import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
  icon?: React.ReactNode;
}

const EmptyState = ({
  title,
  description,
  buttonText,
  onButtonClick,
  icon,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border-2 border-dashed border-slate-300 p-12 text-center animate-in fade-in-50 duration-500">
      {icon && <div className="text-slate-400">{icon}</div>}
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="max-w-md text-slate-600">{description}</p>
      {buttonText && onButtonClick && (
        <Button onClick={onButtonClick} size="lg">
          <PlusCircle className="mr-2 h-5 w-5" />
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
