import { useRef, useState } from "react";

export default function TennisReachVisualizer() {
  const real = {
    doublesWidth: 10.97,
    singlesWidth: 8.23,
    halfLength: 11.885,
    serviceLineFromNet: 6.4,
  };

  const scale = 25;
  const courtMargin = 120;
  const outerSpaceX = 80;
  const outerSpaceTop = 100;
  const outerSpaceBottom = 80;

  const court = {
    width: real.doublesWidth * scale,
    height: real.halfLength * 2 * scale,
    singlesInset: ((real.doublesWidth - real.singlesWidth) / 2) * scale,
    netY: real.halfLength * scale,
    serviceOffset: real.serviceLineFromNet * scale,
    centerX: (real.doublesWidth * scale) / 2,
  };

  const playArea = {
    x: outerSpaceX,
    y: outerSpaceTop,
    width: court.width,
    height: court.height,
  };

  const svgWidth = court.width + outerSpaceX * 2;
  const svgHeight = court.height + outerSpaceTop + outerSpaceBottom;

  const doublesLeftX = playArea.x;
  const doublesRightX = playArea.x + court.width;
  const singlesLeftX = playArea.x + court.singlesInset;
  const singlesRightX = playArea.x + court.width - court.singlesInset;
  const baselineTopY = playArea.y;
  const netY = playArea.y + court.netY;
  const topServiceY = playArea.y + court.netY - court.serviceOffset;
  const bottomServiceY = playArea.y + court.netY + court.serviceOffset;
  const centerServiceX = playArea.x + court.centerX;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const radToDeg = (rad) => (rad * 180) / Math.PI;

  const [showLayers, setShowLayers] = useState({
    doubles: true,
    singles: true,
    service: true,
  });

  const [players, setPlayers] = useState([
    {
      id: 1,
      name: "Player 1",
      side: "bottom",
      x: playArea.x + court.centerX,
      y: playArea.y + court.netY + 190,
      color: "#2563eb",
      reach: 110,
      active: true,
    },
    {
      id: 2,
      name: "Player 2",
      side: "top",
      x: playArea.x + court.centerX,
      y: playArea.y + court.netY - 190,
      color: "#dc2626",
      reach: 110,
      active: false,
    },
  ]);

  const [draggingId, setDraggingId] = useState(null);
  const svgRef = useRef(null);

  const activePlayer = players.find((p) => p.active) || players[0];

  const getMovementBounds = (player) => {
    if (player.side === "top") {
      return {
        minX: playArea.x - courtMargin,
        maxX: playArea.x + playArea.width + courtMargin,
        minY: playArea.y - courtMargin,
        maxY: netY,
      };
    }
    return {
      minX: playArea.x - courtMargin,
      maxX: playArea.x + playArea.width + courtMargin,
      minY: netY,
      maxY: playArea.y + playArea.height + courtMargin,
    };
  };

  const getSvgPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((event.clientY - rect.top) / rect.height) * svgHeight;
    return { x, y };
  };

  const updatePlayerPosition = (id, point) => {
    if (!point) return;
    setPlayers((prev) =>
      prev.map((player) => {
        if (player.id !== id) return player;
        const bounds = getMovementBounds(player);
        return {
          ...player,
          x: clamp(point.x, bounds.minX, bounds.maxX),
          y: clamp(point.y, bounds.minY, bounds.maxY),
        };
      })
    );
  };

  const handlePointerDown = (id) => (event) => {
    event.preventDefault();
    setDraggingId(id);
  };

  const handlePointerMove = (event) => {
    if (draggingId === null) return;
    updatePlayerPosition(draggingId, getSvgPoint(event));
  };

  const handlePointerUp = () => setDraggingId(null);

  const courtCenterX = playArea.x + court.centerX;
  const halfCourtWidth = court.width / 2;
  const baseExtension = 0.6 * scale;
  const distanceToNetNorm = clamp01(Math.abs(activePlayer.y - netY) / court.netY);
  const netProximity = 1 - distanceToNetNorm;
  const activeLateralNorm = (activePlayer.x - courtCenterX) / halfCourtWidth;
  const activeSide = activeLateralNorm < 0 ? "left" : "right";

  const playerOutsideLeft = Math.max(0, singlesLeftX - activePlayer.x);
  const playerOutsideRight = Math.max(0, activePlayer.x - singlesRightX);
  const outsideBoost = 1.0;
  const netApproachBoost = netProximity * 1.2 * scale;

  const singlesLeftBaselineCorner = { x: singlesLeftX, y: baselineTopY - baseExtension };
  const singlesRightBaselineCorner = { x: singlesRightX, y: baselineTopY - baseExtension };
  const serviceLeftCorner = { x: singlesLeftX, y: topServiceY };
  const serviceRightCorner = { x: singlesRightX, y: topServiceY };
  const serviceCenterCorner = { x: centerServiceX, y: topServiceY };

  const interpolate = (p1, p2, t) => ({
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  });

  const extendThroughPoint = (origin, through, extensionDistance) => {
    const dx = through.x - origin.x;
    const dy = through.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    return {
      x: through.x + ux * extensionDistance,
      y: through.y + uy * extensionDistance,
    };
  };

  const extendToEdge = (origin, targetPoint) => {
    const dx = targetPoint.x - origin.x;
    const dy = targetPoint.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const big = Math.max(svgWidth, svgHeight) * 2;
    return {
      x: origin.x + ux * big,
      y: origin.y + uy * big,
    };
  };

  const leftSinglesAnchor =
    activeSide === "left"
      ? interpolate(singlesLeftBaselineCorner, serviceLeftCorner, netProximity)
      : {
          x: singlesLeftX - (playerOutsideRight * outsideBoost + netApproachBoost),
          y: baselineTopY - baseExtension,
        };

  const rightSinglesAnchor =
    activeSide === "right"
      ? interpolate(singlesRightBaselineCorner, serviceRightCorner, netProximity)
      : {
          x: singlesRightX + (playerOutsideLeft * outsideBoost + netApproachBoost),
          y: baselineTopY - baseExtension,
        };

  const volleyCarryDistance = 1.8 * scale;

  const singlesLeftTarget =
    activeSide === "left"
      ? extendThroughPoint(activePlayer, leftSinglesAnchor, volleyCarryDistance)
      : leftSinglesAnchor;

  const singlesRightTarget =
    activeSide === "right"
      ? extendThroughPoint(activePlayer, rightSinglesAnchor, volleyCarryDistance)
      : rightSinglesAnchor;

  const target = {
    doublesLeftWindow: { x: doublesLeftX, y: baselineTopY - baseExtension },
    doublesRightWindow: { x: doublesRightX, y: baselineTopY - baseExtension },
    singlesLeftWindow: singlesLeftTarget,
    singlesRightWindow: singlesRightTarget,
    serviceLeft: serviceLeftCorner,
    serviceCenter: serviceCenterCorner,
    serviceRight: serviceRightCorner,
  };

  const angles = {
    doublesLeftWindow: Math.atan2(target.doublesLeftWindow.y - activePlayer.y, target.doublesLeftWindow.x - activePlayer.x),
    doublesRightWindow: Math.atan2(target.doublesRightWindow.y - activePlayer.y, target.doublesRightWindow.x - activePlayer.x),
    singlesLeftWindow: Math.atan2(target.singlesLeftWindow.y - activePlayer.y, target.singlesLeftWindow.x - activePlayer.x),
    singlesRightWindow: Math.atan2(target.singlesRightWindow.y - activePlayer.y, target.singlesRightWindow.x - activePlayer.x),
    serviceLeft: Math.atan2(target.serviceLeft.y - activePlayer.y, target.serviceLeft.x - activePlayer.x),
    serviceCenter: Math.atan2(target.serviceCenter.y - activePlayer.y, target.serviceCenter.x - activePlayer.x),
    serviceRight: Math.atan2(target.serviceRight.y - activePlayer.y, target.serviceRight.x - activePlayer.x),
  };

  const openingBetween = (a, b) => {
    let diff = Math.abs(radToDeg(b - a));
    if (diff > 180) diff = 360 - diff;
    return diff;
  };

  const openings = {
    windowDoubles: openingBetween(angles.doublesLeftWindow, angles.doublesRightWindow),
    windowSingles: openingBetween(angles.singlesLeftWindow, angles.singlesRightWindow),
    serviceBoxLeft: openingBetween(angles.serviceLeft, angles.serviceCenter),
    serviceBoxRight: openingBetween(angles.serviceCenter, angles.serviceRight),
    serviceLineFull: openingBetween(angles.serviceLeft, angles.serviceRight),
  };

  const activePosition = {
    xMeters: ((activePlayer.x - playArea.x) / scale).toFixed(2),
    yMetersFromTop: ((activePlayer.y - playArea.y) / scale).toFixed(2),
  };

  const singlesLeftEnd = extendToEdge(activePlayer, target.singlesLeftWindow);
  const singlesRightEnd = extendToEdge(activePlayer, target.singlesRightWindow);
  const serviceLeftEnd = extendToEdge(activePlayer, target.serviceLeft);
  const serviceCenterEnd = extendToEdge(activePlayer, target.serviceCenter);
  const serviceRightEnd = extendToEdge(activePlayer, target.serviceRight);

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f1f5f9",
      padding: 24,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 24,
      fontFamily: "Arial, sans-serif",
      boxSizing: "border-box",
    },
    header: {
      maxWidth: 1200,
      width: "100%",
      textAlign: "center",
    },
    h1: {
      margin: 0,
      fontSize: 32,
      color: "#0f172a",
    },
    subtitle: {
      marginTop: 8,
      color: "#475569",
    },
    layout: {
      width: "100%",
      maxWidth: 1400,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 380px",
      gap: 24,
      alignItems: "start",
    },
    card: {
      background: "white",
      borderRadius: 24,
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
      padding: 16,
      overflow: "hidden",
    },
    sideCol: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },
    panel: {
      background: "white",
      borderRadius: 18,
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      padding: 16,
    },
    panelTitle: {
      margin: "0 0 12px 0",
      fontSize: 18,
      color: "#0f172a",
    },
    button: (active) => ({
      width: "100%",
      borderRadius: 12,
      padding: "12px 16px",
      textAlign: "left",
      border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
      background: active ? "#0f172a" : "white",
      color: active ? "white" : "#334155",
      cursor: "pointer",
      marginBottom: 10,
    }),
    toggle: (active) => ({
      width: "100%",
      borderRadius: 10,
      padding: "10px 14px",
      border: "1px solid #cbd5e1",
      background: active ? "#16a34a" : "white",
      color: active ? "white" : "#475569",
      cursor: "pointer",
      marginBottom: 8,
    }),
    text: {
      fontSize: 14,
      color: "#334155",
      lineHeight: 1.7,
      margin: 0,
    },
    strong: {
      fontWeight: 700,
      color: "#0f172a",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Tennis Court Angle Visualizer</h1>
        <p style={styles.subtitle}>Drag players to study the real shot window into the opposite court.</p>
      </div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: "100%", height: "auto", borderRadius: 16, touchAction: "none", userSelect: "none" }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#dbe4ea" />
            <rect
              x={playArea.x - courtMargin}
              y={playArea.y - courtMargin}
              width={playArea.width + courtMargin * 2}
              height={playArea.height + courtMargin * 2}
              rx="16"
              fill="#7c9a6d"
            />
            <rect x={playArea.x} y={playArea.y} width={court.width} height={court.height} fill="#256c3a" rx="10" />
            <rect x={playArea.x} y={playArea.y} width={court.width} height={court.height} fill="none" stroke="white" strokeWidth="3" />
            <line x1={singlesLeftX} y1={playArea.y} x2={singlesLeftX} y2={playArea.y + court.height} stroke="white" strokeWidth="2.5" />
            <line x1={singlesRightX} y1={playArea.y} x2={singlesRightX} y2={playArea.y + court.height} stroke="white" strokeWidth="2.5" />
            <line x1={playArea.x} y1={netY} x2={playArea.x + court.width} y2={netY} stroke="#f8fafc" strokeWidth="5" />
            <line x1={singlesLeftX} y1={topServiceY} x2={singlesRightX} y2={topServiceY} stroke="white" strokeWidth="2.5" />
            <line x1={singlesLeftX} y1={bottomServiceY} x2={singlesRightX} y2={bottomServiceY} stroke="white" strokeWidth="2.5" />
            <line x1={centerServiceX} y1={topServiceY} x2={centerServiceX} y2={bottomServiceY} stroke="white" strokeWidth="2.5" />

            {showLayers.doubles && (
              <>
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.doublesLeftWindow.x},${target.doublesLeftWindow.y} ${target.doublesRightWindow.x},${target.doublesRightWindow.y}`}
                  fill="#60a5fa"
                  opacity="0.08"
                />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={target.doublesLeftWindow.x} y2={target.doublesLeftWindow.y} stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={target.doublesRightWindow.x} y2={target.doublesRightWindow.y} stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="7 5" />
              </>
            )}

            {showLayers.singles && (
              <>
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.singlesLeftWindow.x},${target.singlesLeftWindow.y} ${target.singlesRightWindow.x},${target.singlesRightWindow.y}`}
                  fill="#f59e0b"
                  opacity="0.10"
                />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={singlesLeftEnd.x} y2={singlesLeftEnd.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={singlesRightEnd.x} y2={singlesRightEnd.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="7 5" />
              </>
            )}

            {showLayers.service && (
              <>
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.serviceLeft.x},${target.serviceLeft.y} ${target.serviceCenter.x},${target.serviceCenter.y}`}
                  fill="#a855f7"
                  opacity="0.10"
                />
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.serviceCenter.x},${target.serviceCenter.y} ${target.serviceRight.x},${target.serviceRight.y}`}
                  fill="#22c55e"
                  opacity="0.10"
                />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={serviceLeftEnd.x} y2={serviceLeftEnd.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={serviceCenterEnd.x} y2={serviceCenterEnd.y} stroke="#22c55e" strokeWidth="2" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={serviceRightEnd.x} y2={serviceRightEnd.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="7 5" />
              </>
            )}

            <circle cx={activePlayer.x} cy={activePlayer.y} r={activePlayer.reach} fill={activePlayer.color} opacity="0.10" stroke={activePlayer.color} strokeWidth="2" strokeDasharray="8 6" />

            {players.map((player) => (
              <g key={player.id}>
                <circle
                  cx={player.x}
                  cy={player.y}
                  r="11"
                  fill={player.color}
                  stroke={player.active ? "#f8fafc" : "white"}
                  strokeWidth={player.active ? "4" : "3"}
                  style={{ cursor: "grab" }}
                  onPointerDown={handlePointerDown(player.id)}
                />
                <text x={player.x} y={player.y - 18} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
                  {player.name}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div style={styles.sideCol}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Controls</h2>
            <div>
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setPlayers((prev) => prev.map((p) => ({ ...p, active: p.id === player.id })))}
                  style={styles.button(player.active)}
                >
                  {player.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              {Object.entries(showLayers).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setShowLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  style={styles.toggle(value)}
                >
                  {key.toUpperCase()} {value ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Shot window angles</h2>
            <p style={styles.text}><span style={styles.strong}>Doubles target window:</span> {openings.windowDoubles.toFixed(1)}°</p>
            <p style={styles.text}><span style={styles.strong}>Singles target window:</span> {openings.windowSingles.toFixed(1)}°</p>
            <p style={styles.text}><span style={styles.strong}>Full service window:</span> {openings.serviceLineFull.toFixed(1)}°</p>
            <p style={styles.text}><span style={styles.strong}>Ad service box:</span> {openings.serviceBoxLeft.toFixed(1)}°</p>
            <p style={styles.text}><span style={styles.strong}>Deuce service box:</span> {openings.serviceBoxRight.toFixed(1)}°</p>
            <p style={styles.text}><span style={styles.strong}>Player position:</span> x {activePosition.xMeters} m, y {activePosition.yMetersFromTop} m</p>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Guide</h2>
            <p style={styles.text}><span style={styles.strong}>Blue sector:</span> doubles shot window.</p>
            <p style={styles.text}><span style={styles.strong}>Orange sector:</span> singles shot window. Near the net, the line aims toward the service-line/singles-line intersection and continues beyond it.</p>
            <p style={styles.text}><span style={styles.strong}>Purple/green:</span> service boxes with official service margins.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
