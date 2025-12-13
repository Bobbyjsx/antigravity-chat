"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ErrorMessage } from "./form/ErrorMessage";
import { FormDescription } from "./form/FormDescription";
import { FormLabel } from "./label/FormLabel";

export const inputVariants = cva(
  "!p-0 flex h-full w-full !border-transparent !bg-transparent text-base focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      status: {
        default: "placeholder:text-[#C4C4C4] dark:placeholder:text-[#9299A2]",
        error: "placeholder:text-red-500 text-red-500",
        loading: "placeholder:text-[#C4C4C4] dark:placeholder:text-[#9299A2]",
        prefilled: "",
        neutral: "",
      },
    },
    defaultVariants: {
      status: "default",
    },
  },
);

export interface BaseInnerInputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const BaseInnerInput = React.forwardRef<HTMLInputElement, BaseInnerInputProps>(
  ({ className, status, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ status }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
BaseInnerInput.displayName = "BaseInnerInput";

export const inputContainerVariants = cva(
  "flex relative h-10 w-full rounded-md border border-[#2A2F3A] bg-[#1B1E27] transition px-3 py-2 text-base focus-within:ring-0 focus-within:outline-none focus-within:border-[#3B82F6]",
  {
    variants: {
      status: {
        default:
          "text-white placeholder:text-gray-500",
        error:
          "border-red-500 text-red-500 placeholder:text-red-500",
        loading: "opacity-50",
        prefilled:
          "text-white placeholder:text-gray-500",
        neutral:
          "bg-[#1B1E27] border-[#2A2F3A] text-white placeholder:text-gray-600",
      },
    },
    defaultVariants: { status: "default" },
  },
);


export const sideVariants = cva(
  "top-0 flex justify-center items-center h-full min-w-[40px] transition text-base border-l",
  {
    variants: {
      side: {
        left: "left-0 rounded-l-md",
        right: "right-0 rounded-r-md",
      },
      status: {
        default:
          "bg-[#1B1E27] text-gray-300 border-none",
        error:
          "text-red-500 bg-[#2A0F0F]",
        loading: "opacity-50",
        prefilled:
          "bg-[#1B1E27] text-gray-300 border-none",
        neutral:
          "bg-transparent text-gray-400 border-none",
      },
    },
    defaultVariants: { status: "default", side: "left" },
  },
);

export interface InputProps
  extends BaseInnerInputProps,
    VariantProps<typeof inputContainerVariants> {
  isLoading?: boolean;
  error?: string;
  leftNode?: React.ReactNode;
  rightNode?: React.ReactNode;
  sideNodeClassName?: string;
  label?: string;
  showAsterisk?: boolean;
  description?: React.ReactNode;
  isContentSensitive?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      status = "default",
      disabled,
      error,
      isLoading,
      sideNodeClassName,
      showAsterisk,
      label,
      description,
      ...props
    },
    ref,
  ) => {
    let containerStatus: VariantProps<typeof inputContainerVariants>["status"] =
      status;

    if (error) containerStatus = "error";
    if (isLoading) containerStatus = "loading";
    if (disabled) containerStatus = "prefilled";

    return (
      <div className="relative space-y-1 w-full">
        {label && (
          <FormLabel showAsterisk={showAsterisk} error={error}>
            {label}
          </FormLabel>
        )}
        <div
          className={cn(
            inputContainerVariants({ status: containerStatus }),
            props.leftNode ? "pl-0" : "",
            props.rightNode ? "pr-0" : "",
            className,
          )}
        >
          {props.leftNode ? (
            <div
              className={cn(
                sideVariants({
                  status: containerStatus,
                  side: "left",
                }),
                sideNodeClassName,
              )}
            >
              {props.leftNode}
            </div>
          ) : null}
          <BaseInnerInput
            ref={ref}
            disabled={isLoading || disabled}
            className={cn({
              "!pl-3": props.leftNode && status !== "neutral",
              "!pr-3": props.rightNode && status !== "neutral",
              "sentry-mask": !!props?.isContentSensitive,
            })}
            {...props}
          />
          {props.rightNode ? (
            <div
              className={cn(
                sideVariants({
                  status: containerStatus,
                  side: "right",
                }),
                sideNodeClassName,
              )}
            >
              {props.rightNode}
            </div>
          ) : null}
        </div>
        {description && (
          <FormDescription className="text-gray-400 text-sm !font-normal">
            {description}
          </FormDescription>
        )}
        <ErrorMessage error={error} />
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
