"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_KEY, DEFAULT_GA_MEASUREMENT_ID, analyticsPage, createAnalyticsClient, setAnalyticsClient } from "../lib/analytics.mjs";

export default function Analytics() {
  const pathname = usePathname();
  const client = useRef(null);
  const [visible, setVisible] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const instance = createAnalyticsClient(window, {
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID,
      enabled: process.env.NEXT_PUBLIC_GA_ENABLED || "true",
      production: process.env.NODE_ENV === "production",
    });
    client.current = instance;
    setAnalyticsClient(instance);
    setAvailable(instance.eligible);
    if (instance.eligible) {
      setVisible(!instance.consent());
      instance.start();
    }
    function search(event) {
      if (event.target.matches?.('form[data-analytics="zip-search"]')) {
        instance.event("zip_search", { zip: new FormData(event.target).get("zip") });
      }
    }
    document.addEventListener("submit", search);
    function changed(event) {
      if (event.key === CONSENT_KEY && event.newValue !== "granted") instance.choose("denied");
    }
    window.addEventListener("storage", changed);
    return () => { document.removeEventListener("submit", search); window.removeEventListener("storage", changed); setAnalyticsClient(null); };
  }, []);
  useEffect(() => { client.current?.page(pathname); }, [pathname]);
  if (!available || !analyticsPage(pathname)) return null;
  function choose(value) { client.current.choose(value); setVisible(false); }
  return (
    <>
      <div className="analytics-settings"><button className="text-button" onClick={() => setVisible(true)}>Analytics preferences</button></div>
      {visible && <section className="analytics-consent" aria-labelledby="analytics-title">
        <div><h2 id="analytics-title">Help us improve?</h2><p>Allow optional Google Analytics to measure visits and report use. Your choice won’t affect your report. <a href="/privacy">Privacy</a></p></div>
        <div className="analytics-actions"><button className="secondary" onClick={() => choose("denied")}>No thanks</button><button onClick={() => choose("granted")}>Allow analytics</button></div>
      </section>}
    </>
  );
}
