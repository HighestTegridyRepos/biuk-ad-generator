import React from "react"
import { renderTextPng } from "./text-render" // We will replace this

// This will be the new entry point, generating a single SVG for the whole overlay
export function buildAdOverlaySvg(
  width: number,
  height: number,
  headline: string,
  subhead: string | null | undefined,
  callouts: Array<{ text: string; position: { x: number; y: number } }>,
  bannerColor: string,
  bannerText: string
): React.ReactElement {
  const bannerH = Math.round(height * 0.09)
  const bannerY = height - bannerH

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Headline and Subhead */}
      <div
        style={{
          position: "absolute",
          top: `${Math.round(height * 0.05)}px`,
          left: "40px",
          right: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          color: "#FF00FF", // Magenta for testing
        }}
      >
        <p style={{ fontSize: 48, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>{headline}</p>
        {subhead && <p style={{ fontSize: 26, margin: "8px 0 0", fontWeight: 400 }}>{subhead}</p>}
      </div>

      {/* Callouts */}
      {callouts.map((callout, i) => {
        const bubbleW = 200
        const bubbleH = 80
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${Math.max(0, Math.round(callout.position.x - bubbleW / 2))}px`,
              top: `${Math.max(0, Math.round(callout.position.y - bubbleH / 2))}px`,
              width: bubbleW,
              height: bubbleH,
              backgroundColor: "rgba(0,0,0,0.8)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "8px",
              color: "#FF00FF", // Magenta
              fontSize: 16,
              fontWeight: 700,
              border: "2px solid #00FFFF" // Cyan border for visibility
            }}
          >
            {callout.text}
          </div>
        )
      })}

      {/* Banner */}
      <div
        style={{
          position: "absolute",
          bottom: "0px",
          left: "0px",
          width: "100%",
          height: `${bannerH}px`,
          backgroundColor: bannerColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FF00FF", // Magenta
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {bannerText}
      </div>
    </div>
  )
}
