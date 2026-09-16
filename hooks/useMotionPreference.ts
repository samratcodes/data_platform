"use client";
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
const subscribe = () => () => {};
export function useMotionPreference() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const reduced = useReducedMotion();
  return hydrated && !!reduced;
}
