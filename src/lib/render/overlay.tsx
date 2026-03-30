import React from "react"

interface CalloutWithAnchor {
  text: string
  position: { x: number; y: number }
  anchorPoint: { x: number; y: number }
}

export function buildAdOverlaySvg(
  width: number,
  height: number,
  headline: string,
  subhead: string | null | undefined,
  callouts: CalloutWithAnchor[],
  bannerColor: string,
  bannerText: string
): React.ReactElement {
  const s = width / 1080
  const bannerH = Math.round(height * 0.09)
  const bannerTop = height - bannerH
  const headlineTop = Math.round(height * 0.05)
  const headlinePad = Math.round(40 * s)
  const headlineWidth = width - headlinePad * 2
  const bubbleW = Math.round(190 * s)
  const bubbleH = Math.round(76 * s)
  const bubbleFontSize = Math.round(14 * s)
  const bannerFontSize = Math.round(22 * s)
  const headlineFontSize = Math.round(60 * s)
  const subheadFontSize = Math.round(26 * s)

  return (
    // Root: explicit width+height+display:flex required by satori
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
      }}
    >
      {/* Connector lines — rendered first (behind bubbles, behind product) */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
        }}
      >
        {callouts.map((callout, i) => {
          const bubbleCenterX = callout.position.x + bubbleW / 2
          const bubbleCenterY = callout.position.y + bubbleH / 2
          const ax = callout.anchorPoint.x
          const ay = callout.anchorPoint.y
          return (
            <g key={i}>
              {/* White shadow under line for visibility */}
              <line x1={bubbleCenterX} y1={bubbleCenterY} x2={ax} y2={ay} stroke="white" strokeWidth={4} strokeLinecap="round" />
              {/* Colored line */}
              <line x1={bubbleCenterX} y1={bubbleCenterY} x2={ax} y2={ay} stroke={bannerColor} strokeWidth={2} strokeLinecap="round" />
              {/* Dot: white outline + colored fill */}
              <circle cx={ax} cy={ay} r={10} fill="white" />
              <circle cx={ax} cy={ay} r={8} fill={bannerColor} />
            </g>
          )
        })}
      </svg>

      {/* Headline — all numbers, no <p>, no right/bottom props */}
      <div
        style={{
          position: "absolute",
          top: headlineTop,
          left: headlinePad,
          width: headlineWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            color: "#FFFFFF",
            fontSize: headlineFontSize,
            fontWeight: 700,
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          {headline}
        </div>
        {subhead ? (
          <div
            style={{
              display: "flex",
              color: "#FFFFFF",
              fontSize: subheadFontSize,
              fontWeight: 400,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {subhead}
          </div>
        ) : null}
      </div>

      {/* Callout bubbles */}
      {callouts.map((callout, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: Math.max(0, callout.position.x),
            top: Math.max(0, callout.position.y),
            width: bubbleW,
            height: bubbleH,
            backgroundColor: "rgba(0,0,0,0.85)",
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: "solid",
            borderColor: bannerColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#FFFFFF",
              fontSize: bubbleFontSize,
              fontWeight: 700,
              textAlign: "center",
              padding: 8,
            }}
          >
            {callout.text}
          </div>
        </div>
      ))}

      {/* Banner — use top: height-bannerH, width as number, no % or bottom */}
      <div
        style={{
          position: "absolute",
          top: bannerTop,
          left: 0,
          width,
          height: bannerH,
          backgroundColor: bannerColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#FFFFFF",
            fontSize: bannerFontSize,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {bannerText}
        </div>
      </div>
    </div>
  )
}
