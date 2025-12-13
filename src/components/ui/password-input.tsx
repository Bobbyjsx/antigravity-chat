import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  isLoading?: boolean;
  error?: string;
  label?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <Input
        type={showPassword ? "text" : "password"}
        className={className}
        ref={ref}
        rightNode={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-full w-full hover:bg-transparent"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={props.disabled || props.isLoading}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4 text-gray-400" aria-hidden="true" />
            )}
            <span className="sr-only">
              {showPassword ? "Hide password" : "Show password"}
            </span>
          </Button>
        }
        {...props}
      />
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
