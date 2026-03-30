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

  // ── Sizes (scaled) ──
  const bannerH = Math.round(height * 0.09)          // ~97px at 1080
  const bannerTop = height - bannerH
  const bannerFontSize = Math.round(38 * s)

  const headlineTop = Math.round(height * 0.03)
  const headlinePad = Math.round(30 * s)
  const headlineWidth = width - headlinePad * 2
  const headlineFontSize = Math.round(85 * s)
  const subheadFontSize = Math.round(28 * s)
  // Headline backdrop: full width, auto height via padding
  const headlineBackdropPadV = Math.round(20 * s)

  // Bubbles: 240×90 at 1080 — but autoPositionCallouts uses 190×76 for position calc.
  // position.x/y = top-left assuming 190×76. Re-center for actual 240×90.
  const oldBubbleW = Math.round(190 * s)
  const oldBubbleH = Math.round(76 * s)
  const bubbleW = Math.round(240 * s)
  const bubbleH = Math.round(90 * s)
  const bubbleFontSize = Math.round(26 * s)
  // Offset to keep bubble centered on intended center point
  const bubbleOffsetX = Math.round((bubbleW - oldBubbleW) / 2)
  const bubbleOffsetY = Math.round((bubbleH - oldBubbleH) / 2)

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
      }}
    >
      {/* ── Connector lines (SVG, behind everything else) ── */}
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
          // Bubble center accounting for the recentering offset
          const bx = callout.position.x - bubbleOffsetX + bubbleW / 2
          const by = callout.position.y - bubbleOffsetY + bubbleH / 2
          const ax = callout.anchorPoint.x
          const ay = callout.anchorPoint.y
          return (
            <g key={i}>
              {/* White shadow for contrast on dark backgrounds */}
              <line x1={bx} y1={by} x2={ax} y2={ay}
                stroke="white" strokeWidth={5 * s} strokeLinecap="round" />
              {/* Accent-colored line */}
              <line x1={bx} y1={by} x2={ax} y2={ay}
                stroke={bannerColor} strokeWidth={3 * s} strokeLinecap="round" />
              {/* Dot: white outline + colored fill */}
              <circle cx={ax} cy={ay} r={11 * s} fill="white" />
              <circle cx={ax} cy={ay} r={8 * s} fill={bannerColor} />
            </g>
          )
        })}
      </svg>

      {/* ── Headline dark backdrop panel ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: headlineTop + headlineBackdropPadV,
          paddingBottom: headlineBackdropPadV,
          paddingLeft: headlinePad,
          paddingRight: headlinePad,
          backgroundColor: "rgba(0,0,0,0.50)",
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
            lineHeight: 1.15,
            textAlign: "center",
            textTransform: "uppercase" as const,
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
              marginTop: Math.round(8 * s),
              textAlign: "center",
            }}
          >
            {subhead}
          </div>
        ) : null}
      </div>

      {/* ── Callout bubbles ── */}
      {callouts.map((callout, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: Math.max(0, callout.position.x - bubbleOffsetX),
            top: Math.max(0, callout.position.y - bubbleOffsetY),
            width: bubbleW,
            height: bubbleH,
            backgroundColor: "rgba(0,0,0,0.85)",
            borderRadius: Math.round(12 * s),
            borderWidth: Math.round(2 * s),
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
              padding: Math.round(8 * s),
              lineHeight: 1.2,
            }}
          >
            {callout.text}
          </div>
        </div>
      ))}

      {/* ── Banner ── */}
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
            letterSpacing: Math.round(1.5 * s),
          }}
        >
          {bannerText}
        </div>
      </div>
    </div>
  )
}
