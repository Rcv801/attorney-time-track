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
    <div className="flex flex-col items-center justify-center space-y-5 rounded-xl p-14 text-center animate-in fade-in-50 duration-500"
         style={{
           background: 'linear-gradient(135deg, hsl(40 30% 98%) 0%, hsl(0 0% 100%) 100%)',
           border: '2px dashed hsl(35 25% 85%)',
         }}>
      {icon && <div className="text-slate-300">{icon}</div>}
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="max-w-md text-[14px] text-slate-400 leading-relaxed">{description}</p>
      {buttonText && onButtonClick && (
        <Button onClick={onButtonClick} size="lg" className="btn-premium gap-2 mt-2">
          <PlusCircle className="h-4 w-4" />
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
