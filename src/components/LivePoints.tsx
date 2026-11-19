"use client";

import { useEffect, useState } from "react";
import { POINTS_EVENT, type PointsEventDetail } from "@/lib/points-event";

export default function LivePoints({ postId, points }: { postId: number; points: number }) {
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    function onPoints(event: Event) {
      const detail = (event as CustomEvent<PointsEventDetail>).detail;
      if (!detail || detail.postId !== postId || !Number.isInteger(detail.delta)) return;
      setDelta(detail.delta);
    }

    window.addEventListener(POINTS_EVENT, onPoints);
    return () => window.removeEventListener(POINTS_EVENT, onPoints);
  }, [postId]);

  const shown = Math.max(0, points + delta);
  return (
    <>
      {shown} {shown === 1 ? "point" : "points"}
    </>
  );
}
