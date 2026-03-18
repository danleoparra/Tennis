import { useMemo, useRef, useState } from "react";

export default function TennisReachVisualizer() {
  const real = {
    doublesWidth: 10.97,
    singlesWidth: 8.23,
    halfLength: 11.885,
    serviceLineFromNet: 6.4,
    centerMarkLength: 0.1,
  };

  const scale = 25; // smaller court to emphasize outer green area
  const courtMargin = 120; // expanded green safety area (3x)
  const outerSpaceX = 80; // keep grey thin
  const outerSpaceTop = 100; // keep grey thin
  const outerSpaceBottom = 80; // keep grey thin

  const court = {
    width: real.doublesWidth * scale,
    height: real.halfLength * 2 * scale,
    singlesInset: ((real.doublesWidth - real.singlesWidth) / 2) * scale,
    netY: real.halfLength * scale,
    serviceOffset: real.serviceLineFromNet * scale,
    centerX: (real.doublesWidth * scale) / 2,
    centerMarkLength: real.centerMarkLength * scale,
  };

  const playArea = {
    x: outerSpaceX,
    y: outerSpaceTop,
    width: court.width,
    height: court.height,
  };

  const svgWidth = court.width + outerSpaceX * 2;
  const svgHeight = court.height + outerSpaceTop + outerSpaceBottom;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
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

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  const doublesLeftX = playArea.x;
  const doublesRightX = playArea.x + court.width;
  const singlesLeftX = playArea.x + court.singlesInset;
  const singlesRightX = playArea.x + court.width - court.singlesInset;
  const baselineTopY = playArea.y;
  const netY = playArea.y + court.netY;
  const topServiceY = playArea.y + court.netY - court.serviceOffset;
  const centerServiceX = playArea.x + court.centerX;

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

  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const courtCenterX = playArea.x + court.centerX;
  const halfCourtWidth = court.width / 2;

  // Official geometry only
  const baseExtension = 0.6 * scale;
  const distanceToNetNorm = clamp01(Math.abs(activePlayer.y - netY) / court.netY);
  const netProximity = 1 - distanceToNetNorm; // 0 baseline, 1 net

  const activeLateralNorm = (activePlayer.x - courtCenterX) / halfCourtWidth;
  const activeSide = activeLateralNorm < 0 ? "left" : "right";

  // Player may move outside the singles sideline, which can open the cross-court angle,
  // but the reference court margins remain official.
  const playerOutsideLeft = Math.max(0, singlesLeftX - activePlayer.x);
  const playerOutsideRight = Math.max(0, activePlayer.x - singlesRightX);
  const outsideBoost = 1.0;
  const netApproachBoost = netProximity * 1.2 * scale;

  // Official anchors
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

  // Singles:
  // - down-the-line stays tied to the official singles corner
  // - cross-court can open more, especially if player is outside the sideline
  // - near the net, the DTL side aims toward the service-line/singles-line intersection
  const leftSinglesAnchor = activeSide === "left"
    ? interpolate(singlesLeftBaselineCorner, serviceLeftCorner, netProximity)
    : {
        x: singlesLeftX - (playerOutsideRight * outsideBoost + netApproachBoost),
        y: baselineTopY - baseExtension,
      };

  const rightSinglesAnchor = activeSide === "right"
    ? interpolate(singlesRightBaselineCorner, serviceRightCorner, netProximity)
    : {
        x: singlesRightX + (playerOutsideLeft * outsideBoost + netApproachBoost),
        y: baselineTopY - baseExtension,
      };

  const volleyCarryDistance = 1.8 * scale;

  const singlesLeftTarget = activeSide === "left"
    ? extendThroughPoint(activePlayer, leftSinglesAnchor, volleyCarryDistance)
    : leftSinglesAnchor;

  const singlesRightTarget = activeSide === "right"
    ? extendThroughPoint(activePlayer, rightSinglesAnchor, volleyCarryDistance)
    : rightSinglesAnchor;

  // Service: keep official service box margins only
  const target = {
    doublesLeftWindow: { x: doublesLeftX, y: baselineTopY - baseExtension },
    doublesRightWindow: { x: doublesRightX, y: baselineTopY - baseExtension },
    singlesLeftWindow: singlesLeftTarget,
    singlesRightWindow: singlesRightTarget,
    serviceLeft: serviceLeftCorner,
    serviceCenter: serviceCenterCorner,
    serviceRight: serviceRightCorner,
  };

  const angleTo = (point) => Math.atan2(point.y - activePlayer.y, point.x - activePlayer.x);
  const openingBetween = (a, b) => {
    let diff = Math.abs(radToDeg(b - a));
    if (diff > 180) diff = 360 - diff;
    return diff;
  };

  const angles = {
    doublesLeftWindow: angleTo(target.doublesLeftWindow),
    doublesRightWindow: angleTo(target.doublesRightWindow),
    singlesLeftWindow: angleTo(target.singlesLeftWindow),
    singlesRightWindow: angleTo(target.singlesRightWindow),
    serviceLeft: angleTo(target.serviceLeft),
    serviceCenter: angleTo(target.serviceCenter),
    serviceRight: angleTo(target.serviceRight),
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
    yMetersFromNet: ((activePlayer.y - netY) / scale).toFixed(2),
  };

  

  

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center gap-6">
      <div className="max-w-6xl w-full text-center">
        <h1 className="text-3xl font-bold text-slate-900">Tennis Court Angle Visualizer</h1>
        <p className="text-slate-600 mt-2">
          Drag players to study the real shot window into the opposite court (no net-crossing guides).
        </p>
      </div>

      <div className="w-full max-w-7xl grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="bg-white rounded-3xl shadow-xl p-4 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto rounded-2xl touch-none select-none"
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

            <rect
              x={playArea.x}
              y={playArea.y}
              width={court.width}
              height={court.height}
              fill="none"
              stroke="white"
              strokeWidth="3"
            />

            <line x1={singlesLeftX} y1={playArea.y} x2={singlesLeftX} y2={playArea.y + court.height} stroke="white" strokeWidth="2.5" />
            <line x1={singlesRightX} y1={playArea.y} x2={singlesRightX} y2={playArea.y + court.height} stroke="white" strokeWidth="2.5" />

            <line x1={playArea.x} y1={netY} x2={playArea.x + court.width} y2={netY} stroke="#f8fafc" strokeWidth="5" />

            <line x1={singlesLeftX} y1={topServiceY} x2={singlesRightX} y2={topServiceY} stroke="white" strokeWidth="2.5" />
            <line x1={singlesLeftX} y1={playArea.y + court.netY + court.serviceOffset} x2={singlesRightX} y2={playArea.y + court.netY + court.serviceOffset} stroke="white" strokeWidth="2.5" />

            <line x1={centerServiceX} y1={topServiceY} x2={centerServiceX} y2={playArea.y + court.netY + court.serviceOffset} stroke="white" strokeWidth="2.5" />

            {activePlayer && (
              <>
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

                    {/* Extend singles lines to full image */}
                    {(() => {
                      const extendToEdge = (targetPoint) => {
                        const dx = targetPoint.x - activePlayer.x;
                        const dy = targetPoint.y - activePlayer.y;
                        const length = Math.hypot(dx, dy) || 1;
                        const ux = dx / length;
                        const uy = dy / length;
                        const big = Math.max(svgWidth, svgHeight) * 2;
                        return {
                          x: activePlayer.x + ux * big,
                          y: activePlayer.y + uy * big,
                        };
                      };

                      const leftEnd = extendToEdge(target.singlesLeftWindow);
                      const rightEnd = extendToEdge(target.singlesRightWindow);

                      return (
                        <>
                          <line
                            x1={activePlayer.x}
                            y1={activePlayer.y}
                            x2={leftEnd.x}
                            y2={leftEnd.y}
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            strokeDasharray="7 5"
                          />
                          <line
                            x1={activePlayer.x}
                            y1={activePlayer.y}
                            x2={rightEnd.x}
                            y2={rightEnd.y}
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            strokeDasharray="7 5"
                          />
                        </>
                      );
                    })()}
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

                    {(() => {
                      const extendToEdge = (targetPoint) => {
                        const dx = targetPoint.x - activePlayer.x;
                        const dy = targetPoint.y - activePlayer.y;
                        const length = Math.hypot(dx, dy) || 1;
                        const ux = dx / length;
                        const uy = dy / length;
                        const big = Math.max(svgWidth, svgHeight) * 2;
                        return {
                          x: activePlayer.x + ux * big,
                          y: activePlayer.y + uy * big,
                        };
                      };

                      const leftEnd = extendToEdge(target.serviceLeft);
                      const centerEnd = extendToEdge(target.serviceCenter);
                      const rightEnd = extendToEdge(target.serviceRight);

                      return (
                        <>
                          <line x1={activePlayer.x} y1={activePlayer.y} x2={leftEnd.x} y2={leftEnd.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="7 5" />
                          <line x1={activePlayer.x} y1={activePlayer.y} x2={centerEnd.x} y2={centerEnd.y} stroke="#22c55e" strokeWidth="2" strokeDasharray="7 5" />
                          <line x1={activePlayer.x} y1={activePlayer.y} x2={rightEnd.x} y2={rightEnd.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="7 5" />
                        </>
                      );
                    })()}
                  </>
                )}

                <circle cx={activePlayer.x} cy={activePlayer.y} r={activePlayer.reach} fill={activePlayer.color} opacity="0.10" stroke={activePlayer.color} strokeWidth="2" strokeDasharray="8 6" />
              </>
            )}

            {players.map((player) => (
              <g key={player.id}>
                <circle cx={player.x} cy={player.y} r="11" fill={player.color} stroke={player.active ? "#f8fafc" : "white"} strokeWidth={player.active ? "4" : "3"} className="cursor-grab active:cursor-grabbing" onPointerDown={handlePointerDown(player.id)} />
                <text x={player.x} y={player.y - 18} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
                  {player.name}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-md p-4">
            <h2 className="font-semibold text-slate-900 mb-3">Controls</h2>
            <div className="space-y-3">
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setPlayers((prev) => prev.map((p) => ({ ...p, active: p.id === player.id })))}
                  className={`w-full rounded-xl px-4 py-3 text-left border transition ${player.active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {player.name}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {Object.entries(showLayers).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setShowLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${value ? "bg-green-600 text-white" : "bg-white text-slate-600"}`}
                >
                  {key.toUpperCase()} {value ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          <div className="bg-white rounded-2xl shadow-md p-4">
            <h2 className="font-semibold text-slate-900 mb-2">Shot window angles</h2>
            <div className="text-sm text-slate-700 space-y-2 leading-6">
              <p><span className="font-medium">Doubles target window:</span> {openings.windowDoubles.toFixed(1)}°</p>
              <p><span className="font-medium">Singles target window:</span> {openings.windowSingles.toFixed(1)}°</p>
              <p><span className="font-medium">Full service window:</span> {openings.serviceLineFull.toFixed(1)}°</p>
              <p><span className="font-medium">Ad service box:</span> {openings.serviceBoxLeft.toFixed(1)}°</p>
              <p><span className="font-medium">Deuce service box:</span> {openings.serviceBoxRight.toFixed(1)}°</p>
              <p><span className="font-medium">Player position:</span> x {activePosition.xMeters} m, y {activePosition.yMetersFromTop} m</p>
            </div>
          </div>

          
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4">
            <h2 className="font-semibold text-slate-900 mb-2">Guide</h2>
            <div className="text-sm text-slate-600 leading-6 space-y-2">
              <p><span className="font-medium text-slate-800">Blue sector:</span> doubles shot window.</p>
              <p><span className="font-medium text-slate-800">Orange sector:</span> singles shot window. Near the net, the line aims toward the service-line/singles-line intersection, but it keeps going beyond that point instead of stopping there.</p>
              <p><span className="font-medium text-slate-800">Purple/green:</span> service boxes.</p>
              <p>Singles uses the official singles margins. Near the net, the line aims toward the service-line/singles-line intersection and then continues through it.</p>
              <p>Service uses the official service box margins only, but the service guide lines continue to the edge of the image.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
