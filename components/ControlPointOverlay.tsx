"use client";

import { ControlPoint, PlatImage } from "@/types";
import { localToWorld } from "@/lib/transforms";

export default function ControlPointOverlay({
    points,
    images,
    viewScale,
}: {
    points: ControlPoint[];
    images: PlatImage[];
    viewScale: number;
}) {
   return (
       <svg
           className="absolute top-0 left-0 pointer-events-none"
           width="100%"
           height="100%"
       >
           {points.map((point) => {
               const a = images.find((x) => x.id === point.aId);
               const b = images.find((x) => x.id === point.bId);

               if (!a || !b) {
                   return null;
               }

               const p1 = localToWorld(a, point.ax, point.ay);
               const p2 = localToWorld(b, point.bx, point.by);

               return (
                   <g key={point.id}>
                       <line
                           x1={p1.x * viewScale}
                           y1={p1.y * viewScale}
                           x2={p2.x * viewScale}
                           y2={p2.y * viewScale}
                           stroke={point.auto ? "#5b9dd9" : "#e8735c"}
                           strokeDasharray="5"
                       />
                       <circle cx={p1.x * viewScale} cy={p1.y * viewScale} r="5" fill={point.auto ? "#5b9dd9" : "#e8735c"} />
                       <circle cx={p2.x * viewScale} cy={p2.y * viewScale} r="5" fill={point.auto ? "#5b9dd9" : "#e8735c"} />
                   </g>
               );
           })}
       </svg>
   );
}
