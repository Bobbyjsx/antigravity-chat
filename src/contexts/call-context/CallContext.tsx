
"use client";

import { createContext } from "react";
import { CallContextType } from "./types";

export const CallContext = createContext<CallContextType | undefined>(undefined);
