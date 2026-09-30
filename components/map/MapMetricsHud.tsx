"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Database, Webcam } from "lucide-react";
import { useMotionPreference } from "@/hooks/useMotionPreference";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  const frame = useRef(0);
  const reducedMotion = useMotionPreference();

  useEffect(() => {
    if (reducedMotion) return;

    const started = performance.now();
    const animate = (time: number) => {
      const progress = Math.min((time - started) / 900, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCurrent(value * easeOut);
      
      if (progress < 1) {
        frame.current = requestAnimationFrame(animate);
      } else {
        setCurrent(value);
      }
    };
    
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current);
  }, [reducedMotion, value]);

  const displayed = reducedMotion ? value : current;
  const displayValue = value % 1 !== 0 
    ? displayed.toFixed(2) 
    : Math.round(displayed).toLocaleString();

  return <>{displayValue}{suffix}</>;
}

export default function MapMetricsHud({ companies, facilities, deviceCompanies }: { companies: number; facilities: number; deviceCompanies: number }) {
  return (
    <section className="metrics-hud" aria-label="Live network metrics">
      <span className="metrics-hud-status"><i/>Live network</span>
      <article className="metric-card metric-companies">
        <span className="metric-icon">
          <Building2 size={20} strokeWidth={1.5} />
        </span>
        <div>
          <small>Companies</small>
          <strong aria-label={`${companies} companies`}><AnimatedNumber value={companies} /></strong>
        </div>
      </article>
      
      <article className="metric-card metric-facilities">
        <span className="metric-icon">
          <Database size={20} strokeWidth={1.5} />
        </span>
        <div>
          <small>Facilities</small>
          <strong aria-label={`${facilities} facilities`}><AnimatedNumber value={facilities} /></strong>
        </div>
      </article>
      
      <article className="metric-card metric-capacity">
        <span className="metric-icon">
          <Webcam size={20} strokeWidth={1.5} />
        </span>
        <div>
          <small>Device companies</small>
          <strong aria-label={`${deviceCompanies} device companies`}><AnimatedNumber value={deviceCompanies} /></strong>
        </div>
      </article>
    </section>
  );
}
