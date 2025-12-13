import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  showAsterisk?: boolean;
  error?: string;
  className?: string;
  children?: React.ReactNode;
}

export function FormLabel({ children, showAsterisk, error, className, ...props }: FormLabelProps) {
  return (
    <Label
      className={cn(
        error && "text-red-500",
        className
      )}
      {...props}
    >
      {children}
      {showAsterisk && <span className="text-red-500 ml-1">*</span>}
    </Label>
  );
}
